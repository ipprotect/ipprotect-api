import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../common/config/config.service';

export interface AIMetadata {
  title: string;
  description: string;
  category: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(private readonly cfg: AppConfigService) {}

  async generateMetadata(filename: string, _mimeType: string): Promise<AIMetadata> {
    const openAiKey = this.cfg.getOpenAiKey();

    if (!openAiKey) {
      this.logger.warn('OpenAI not configured, using fallback metadata');
      return this.getFallbackMetadata(filename);
    }

    try {
      // Simple fallback for now - you can enhance this with actual OpenAI API calls
      await Promise.resolve(); // Placeholder for actual async work
      return this.getFallbackMetadata(filename);
    } catch (error) {
      this.logger.error('AI metadata generation failed', error);
      return this.getFallbackMetadata(filename);
    }
  }

  private getFallbackMetadata(filename: string): AIMetadata {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    let category = 'other';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext)) {
      category = 'image';
    } else if (['pdf'].includes(ext)) {
      category = 'document';
    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
      category = 'audio';
    }

    return {
      title: filename,
      description: `File of type ${ext.toUpperCase()}`,
      category,
    };
  }
}
