/**
 * @module Templating
 * @main Templating
 */

/**
 * Accessing validation information in your templates is really simple but the pathing can be quite long. For example, if we want to display the error `message` for the `username` attribute, it would look something like this:
 *
 * ```handlebars
 * {{model.validations.attrs.username.message}}
 * ```
 *
 * ## The V-Get Helper
 * To bypass such long pathing, you can use the `v-get` helper.
 *
 * _**Notice**: Ember v1.13.0 is not supported due to a bug. Please use Ember v1.13.1 and higher or Ember v1.12.* and lower_
 *
 * **Access global model properties**
 *
 * ```handlebars
 * {{v-get model 'isValid'}}
 * ```
 *
 * **Access attribute specific properties**
 *
 * ```handlebars
 * {{v-get model 'username' 'message'}}
 * ```
 *
 * **Access model relationship validations**
 *
 * Say we have a `user` model with a `details` attribute that is a belongsTo relationship, to access validations on the `details` attribute/model we can access it as such.
 *
 * ```handlebars
 * {{v-get model.details 'isValid'}}
 * {{v-get model.details 'firstName' 'message'}}
 * ```
 *
 * What's awesome about this is that you can pass in bound properties!
 *
 * ```handlebars
 * {{v-get model attr prop}}
 * {{v-get model prop}}
 * ```
 *
 * Here is a more extensive example:
 * ```handlebars
 * <form>
 *   {{input value=model.username placeholder="Username"}}
 *   {{#if (v-get model 'username' 'isInvalid')}}
 *     <div class="error">
 *       {{v-get model 'username' 'message'}}
 *     </div>
 *   {{/if}}
 *
 *   <button type="submit" disabled={{v-get model 'isInvalid'}}>Submit</button>
 * </form>
 * ```
 *
 * @module Templating
 * @submodule V-Get Helper
 */

/* eslint-env node */

class VGet {
  constructor(options) {
    this.options = options;
    this.syntax = null; // set by HTMLBars
  }

  transform(ast) {
    let { traverse } = this.syntax;

    traverse(ast, {
      BlockStatement(node) {
        this.processNode(node);
      },
      MustacheStatement(node) {
        this.processNode(node);
      },
      ElementNode(node) {
        this.processNode(node);
      }
    });

    return ast;
  }

  processNode(node) {
    let type = node.type;
    node = unwrapNode(node);

    // {{v-get model 'username' 'isValid'}}
    if (type === 'MustacheStatement' && node.path.original === 'v-get') {
      this.transformToGet(node);
    }

    this.processNodeParams(node);
    this.processNodeHash(node);
    this.processNodeAttributes(node);
  }

  /**
   * {{#if (v-get model 'username' 'isValid')}} {{/if}}
   * @param  {AST.Node} node
   */
  processNodeParams(node) {
    if (node.params) {
      for (let param of node.params) {
        if (param.type === 'SubExpression') {
          if (param.path.original === 'v-get') {
            this.transformToGet(param);
          } else {
            this.processNode(param);
          }
        }
      }
    }
  }

  /**
   * {{x-component prop=(v-get model 'isValid')}}
   * @param  {AST.Node} node
   */
  processNodeHash(node) {
    if (node.hash && node.hash.pairs) {
      for (let pair of node.hash.pairs) {
        if (pair.value.type === 'SubExpression') {
          if (pair.value.path.original === 'v-get') {
            this.transformToGet(pair.value);
          } else {
            this.processNode(pair.value);
          }
        }
      }
    }
  }

  /**
   * <button type="submit" disabled={{v-get model 'isInvalid'}}>Submit</button> (node.attributes)
   * <div class="form-group {{if (v-get model 'isInvalid') 'has-error'}}">
   * @param  {AST.Node} node
   */
  processNodeAttributes(node) {
    if (node.attributes) {
      for (let attr of node.attributes) {
        this.processNode(attr.value);
      }
    }

    if (node.parts) {
      for (let part of node.parts) {
        this.processNode(part);
      }
    }
  }

  /**
   * Transform:
   *  (v-get model 'username' 'isValid') to (get (get (get (get model 'validations') 'attrs') 'username') 'isValid')
   * OR
   *  (v-get model 'isValid') to (get (get model 'validations') 'isValid')
   * @param  {AST.Node} node
   * @return {AST.Node}
   */
  transformToGet(node) {
    node = unwrapNode(node);
    let params = node.params;
    let numParams = params.length;

    if (numParams < 2) {
      throw new Error('{{v-get}} requires at least two arguments');
    }
    if (params[0].type !== 'PathExpression') {
      throw new Error('The first argument to {{v-get}} must be a stream');
    }

    // (get model 'validations')
    let root = this.syntax.builders.sexpr(this.syntax.builders.path('get'), [
      params[0],
      this.syntax.builders.string('validations')
    ]);

    // (get (get (get model 'validations') 'attrs') 'username')
    if (numParams === 3) {
      root = this.syntax.builders.sexpr(this.syntax.builders.path('get'), [
        root,
        this.syntax.builders.string('attrs')
      ]);
      root = this.syntax.builders.sexpr(this.syntax.builders.path('get'), [
        root,
        params[1]
      ]);
    }

    node.path = this.syntax.builders.path('get');
    // (get root 'isValid')
    node.params = [root, params[numParams - 1]];
  }
}

// For compatibility with pre- and post-glimmer
function unwrapNode(node) {
  if (node.sexpr) {
    return node.sexpr;
  } else {
    return node;
  }
}

module.exports = VGet;
