import { Context } from "elysia";
import ejs from "ejs";
import { readFile } from "fs/promises";
import { join } from "path";

export interface EjsOptions {
  viewsDir?: string;
  cache?: boolean;
}

export function ejsPlugin(options: EjsOptions = {}) {
  const { viewsDir = join(process.cwd(), 'views'), cache = true } = options;

  return {
    name: 'ejs-plugin',
    async onHandle({ request, set }: Context) {
      const originalHandler = (request as any).$handle;
      
      if (typeof originalHandler === 'function') {
        (request as any).$handle = async (...args: any[]) => {
          const result = await originalHandler(...args);
          
          if (result && typeof result === 'object' && '_view' in result) {
            const { _view, ...data } = result;
            
            try {
              const templatePath = join(viewsDir, _view);
              const template = await readFile(templatePath, 'utf-8');
              const html = ejs.render(template, data, {
                cache,
                filename: templatePath,
                views: [viewsDir]
              });
              
              set.headers['Content-Type'] = 'text/html; charset=utf-8';
              return html;
            } catch (error) {
              console.error('EJS rendering error:', error);
              set.status = 500;
              return 'Internal Server Error';
            }
          }
          
          return result;
        };
      }
    }
  };
}

export function render(view: string, data: object = {}) {
  return { _view: view.endsWith('.ejs') ? view : `${view}.ejs`, ...data };
}