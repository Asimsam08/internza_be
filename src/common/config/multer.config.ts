// import { BadRequestException } from '@nestjs/common';
// import { memoryStorage } from 'multer';

// export const multerOptions = {
//   storage: memoryStorage(),

//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB
//   },

//   fileFilter: (
//     req: any,
//     file: Express.Multer.File,
//     cb: Function,
//   ) => {
//     const allowedMimeTypes = [
//       'image/jpeg',
//       'image/png',
//       'image/webp',
//     ];

//     if (!allowedMimeTypes.includes(file.mimetype)) {
//       return cb(
//         new BadRequestException(
//           'Only jpeg, png and webp allowed',
//         ),
//         false,
//       );
//     }

//     cb(null, true);
//   },
// };


import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const multerOptions = {
  storage: memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },

  fileFilter: (
    req: any,
    file: Express.Multer.File,
    cb: (
      error: Error | null,
      acceptFile: boolean,
    ) => void,
  ) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (
      !allowedMimeTypes.includes(
        file.mimetype,
      )
    ) {
      return cb(
        new BadRequestException(
          'Only JPG, PNG, WEBP allowed',
        ),
        false,
      );
    }

    cb(null, true);
  },
};

export const multerScreenshotsOptions = {
  ...multerOptions,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
};