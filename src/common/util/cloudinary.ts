import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class CloudinaryService {
  constructor(private readonly cfg: AppConfigService) {
    cloudinary.config({
      cloud_name: this.cfg.getCloudinaryName(),
      api_key: this.cfg.getCloudinaryApiKey(),
      api_secret: this.cfg.getCloudinaryApiSecret(),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'ipprotect-proofs',
  ): Promise<UploadApiResponse> {
    const allowedMimeTypes = this.cfg.getAllowedMime();

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${allowedMimeTypes.join(', ')}`,
      );
    }

    const maxBytes = this.cfg.getMaxUploadBytes();
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File size exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`,
      );
    }

    const isPdf = file.mimetype === 'application/pdf';

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isPdf ? 'raw' : 'image',
          format: isPdf ? 'pdf' : undefined,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) return reject(new Error(String(error)));
          resolve(result as UploadApiResponse);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
