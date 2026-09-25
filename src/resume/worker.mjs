import { extractResumeFile } from './extract.mjs';
import { parseResumeText } from './parser.mjs';

self.onmessage = async ({ data }) => {
  try {
    const extracted = data.buffer
      ? await extractResumeFile(data.buffer, data.type, message => self.postMessage({ type: 'resume-progress', progress: message }))
      : { text: data.text, warnings: [] };
    const result = parseResumeText(extracted.text, data.schema);
    result.warnings.unshift(...extracted.warnings);
    self.postMessage({ type: 'resume-result', result });
  } catch (error) {
    self.postMessage({ type: 'resume-error', error: error instanceof Error ? error.message : String(error) });
  }
};
