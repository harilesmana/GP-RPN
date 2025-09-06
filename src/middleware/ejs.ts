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

  return (app: any) => 
    app
      .derive({ as: 'global' }, () => ({
        render(view: string, data: object = {}) {
          return { _view: view.endsWith('.ejs') ? view : `${view}.ejs`, ...data };
        }
      }))
      .onAfterHandle(async ({ response, set }: Context) => {
        if (response && typeof response === 'object' && '_view' in response) {
          const { _view, ...data } = response as any;
          
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
        return response;
      });
}