import ejs from "ejs";
import { readFile } from "fs/promises";
import { join } from "path";

const viewsPath = join(process.cwd(), 'views');

export async function render(template: string, data: any = {}): Promise<string> {
  try {
    const templatePath = join(viewsPath, `${template}.ejs`);
    const templateContent = await readFile(templatePath, 'utf-8');
    
    return ejs.render(templateContent, data, {
      root: viewsPath,
      views: [viewsPath],
      cache: process.env.NODE_ENV === 'production'
    });
  } catch (error) {
    console.error(`Error rendering template ${template}:`, error);
    throw new Error(`Template ${template} not found or error rendering`);
  }
}
