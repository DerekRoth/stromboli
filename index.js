'use strict';

const StromboliCore = require('stromboli-core');
const Component = require('./lib/component');
const RenderResult = require('./lib/render-result');

var fs = require('fs');
var log = require('log-util');
var merge = require('merge');
var path = require('path');

// promise support
var Promise = require('promise');
var readDir = Promise.denodeify(fs.readdir);
var stat = Promise.denodeify(fs.stat);
var unlink = Promise.denodeify(fs.unlink);

class Stromboli extends StromboliCore {
  /**
   *
   * @param config {Object}
   */
  start(config) {
    var that = this;

    that.setLogLevel(process.env.npm_config_loglevel);

    // fetch config
    config = merge.recursive(require('./defaults.js'), config);

    if (!Stromboli.checkConfig(config)) {
      throw 'Invalid config file passed as parameter';
    }

    that.debug('CONFIG', config);

    var projectName = config.projectName;
    var projectVersion = config.projectVersion;
    var projectDescription = config.projectDescription;

    log.info(('=').repeat(projectDescription.length));
    log.info(projectName);
    log.info(projectDescription);
    log.info(projectVersion);
    log.info(('=').repeat(projectDescription.length));

    var plugins = null;
    var components = null;

    return Promise.all([
      that.getPlugins(config).then(
        function (results) {
          plugins = results;
        }
      ),
      that.getComponents(config.componentRoot, config.componentManifest).then(
        function (results) {
          components = results;
        }
      )
    ]).then(
      function () {
        return Promise.all(components.map(function (component) {
          return that.buildComponent(component, plugins).then(
            function (component) {
              return component;
            }
          );
        })).then(
          function (components) {
            log.info('<', components.length, 'COMPONENTS RENDERED');

            return Array.prototype.concat.apply([], components);
          }
        );
      }
    );
  };

  static checkConfig(config) {
    if (!config) {
      return false;
    }

    if (!config.projectName) {
      return false;
    }

    if (!config.projectVersion) {
      return false;
    }

    return true;
  };

  getPlugins(config) {
    var that = this;

    that.info('> FETCHING PLUGINS');

    return Promise.all(Object.keys(config.plugins).map(function (key) {
      var plugin = config.plugins[key];
      var pluginModule = plugin.module;
      var pluginEntry = plugin.entry;

      return new pluginModule(plugin.config, key, pluginEntry);
    })).then(
      function (plugins) {
        that.info('<', plugins.length, 'PLUGINS FETCHED');
        that.debug(plugins);

        return plugins;
      }
    )
  };

  getComponents(directory, componentManifest) {
    var that = this;

    that.info('> FETCHING COMPONENTS');

    return that._getComponentsInsideDirectory(directory, componentManifest).then(function (results) {
      that.debug(results);

      var components = Array.prototype.concat.apply([], results.filter(function (result) {
        return (result !== false);
      }));

      that.info('<', components.length, 'COMPONENTS FETCHED');
      that.debug(components);

      return components;
    });
  };

  _getComponentsInsideDirectory(directory, componentManifest) {
    var that = this;

    return readDir(directory).then(
      function (files) {
        return Promise.all(files.map(function (file) {
          var absolutePath = path.resolve(path.join(directory, file));

          return stat(absolutePath).then(
            function (statResult) {
              if (statResult.isDirectory()) {
                return that._getComponentsInsideDirectory(absolutePath, componentManifest);
              }
              else if (statResult.isFile()) {
                if (file == componentManifest) {
                  var manifest = require(absolutePath);
                  var component = new Component(manifest.name, path.dirname(absolutePath));

                  return component;
                }
              }

              return false;
            }
          );
        })).then(
          function (results) {
            return Array.prototype.concat.apply([], results.filter(function (result) {
              return (result !== false);
            }));
          }
        )
      }
    );
  };

  buildComponent(component, plugins) {
    var that = this;

    return Promise.all(plugins.map(function (plugin) {
      return that.pluginRenderComponent(plugin, component);
    })).then(function () {
      return component;
    });
  };

  pluginCleanComponent(plugin, component) {
    var that = this;
    var promises = [];

    // clean dependencies
    if (component.renderResults.has(plugin.name)) {
      /**
       *
       * @type {StromboliRenderResult}
       */
      var renderResult = component.renderResults.get(plugin.name);
      var dependencies = renderResult.getDependencies();
      var output = path.join('dist', component.name);

      dependencies.forEach(function (dependency) {
        var to = path.join(output, path.relative(path.resolve('.'), dependency));

        promises.push(unlink(to).then(
          function () {
            that.debug(to, 'CLEANED');

            return Promise.resolve();
          }
        ));
      });
    }

    return Promise.all(promises);
  };

  pluginRenderComponent(plugin, component) {
    var that = this;
    var beginDate = new Date();

    that.info('> COMPONENT', component.name, 'IS ABOUT TO BE RENDERED BY PLUGIN', plugin.name);

    return that.pluginCleanComponent(plugin, component).then(
      function () {
        var renderResult = new RenderResult();
        var entry = path.resolve(path.join(component.path, plugin.entry));

        var _renderDone = function (file, renderResult, err) {
          if (file) {
            renderResult.addSource(file, err);
          }

          if (err) {
            // we log the error for convenience
            log.error(err);

            if (err.file) {
              renderResult.addDependency(err.file);
            }
          }

          component.renderResults.set(plugin.name, renderResult);

          // write output
          var promises = [];
          var output = path.join('dist', component.name);

          renderResult.getDependencies().forEach(function (dependency) {
            var from = dependency;
            var to = path.join(output, path.relative(path.resolve('.'), dependency));

            that.debug('WILL COPY DEPENDENCY FROM', from, 'TO', to);

            promises.push(that.copyFile(from, to));
          });

          renderResult.getBinaries().forEach(function (binary) {
            var data = binary.data;
            var to = path.join(output, binary.name);

            that.debug('WILL WRITE BINARY FROM', data, 'TO', to);

            promises.push(that.writeFile(to, data));
          });

          return Promise.all(promises).then(
            function () {
              var endDate = new Date();

              that.info('< COMPONENT', component.name, 'HAS BEEN RENDERED BY PLUGIN', plugin.name, 'IN', endDate - beginDate + 'MS');
              that.debug(component);

              return component;
            }
          );
        };

        return that.exists(entry).then(
          function (file) {
            return plugin.render(file, renderResult).then(
              function (renderResult) {
                return _renderDone(file, renderResult, null);
              },
              function (err) {
                return _renderDone(file, renderResult, err);
              }
            );
          },
          function () {
            return _renderDone(null, renderResult, null);
          }
        );
      }
    )
  }
}

module.exports = Stromboli;