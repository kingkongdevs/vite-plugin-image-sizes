const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const { parse } = require('node-html-parser');

// Create a Set to store processed image paths
const processedImages = new Set();

module.exports = (options) => {
  const outputDir = 'dist/assets/images'; // Set the output directory

  return {
    name: 'vite-plugin-images',
    async transformIndexHtml(html, { path: indexPath }) {
      return new Promise(async (resolve, reject) => {
        // Parse the HTML content.
        const root = parse(html);

        // Find all <img> tags in the HTML.
        const imgTags = root.querySelectorAll('img');

        // Create an array to store image processing promises
        const imageProcessingPromises = [];

        // Process each <img> tag.
        for (const imgTag of imgTags) {
          const src = imgTag.getAttribute('src');

          if (src && /\.(jpg|png)$/.test(src)) {
            // Construct the full path to the input image based on /src/assets/images
            const inputImagePath = path.resolve('src/assets/images', src);

            console.log(`Processing image: ${inputImagePath}`);

            // Check if the input image file exists.
            if (fs.existsSync(inputImagePath)) {
              // Check if the image has already been processed
              if (!processedImages.has(inputImagePath)) {
                // Add the input image path to the processed images Set
                processedImages.add(inputImagePath);

                // Process the image (resize and convert to webp).
                const image = sharp(inputImagePath);
                const sizes = [320, 640, 1024];
                const imagePromises = sizes.map(async (size) => {
                  console.log(`Resizing image to ${size}px: ${inputImagePath}`);
                  const webpBuffer = await image.clone().resize(size).toFormat('webp').toBuffer();
                  const webpFileName = `${path.basename(src, path.extname(src))}-${size}px.webp`;

                  // Specify the output directory and file path
                  const outputImagePath = path.resolve(outputDir, webpFileName);

                  // Ensure that parent directories are created if they don't exist.
                  await fs.ensureDir(path.dirname(outputImagePath));

                  await fs.outputFile(outputImagePath, webpBuffer);
                  console.log(`Generated WebP image: ${outputImagePath}`);
                });

                imageProcessingPromises.push(...imagePromises);
              } else {
                console.log(`Image already processed: ${inputImagePath}`);
              }

              // Update the src attribute of the <img> tag.
              imgTag.setAttribute('src', src); // Use the original src

              console.log(`Updated <img> src attribute: ${src}`);
            } else {
              reject(new Error(`Input file is missing: ${inputImagePath}`));
              return;
            }
          }
        }

        // Wait for all image processing promises to complete
        await Promise.all(imageProcessingPromises);

        // Update the HTML code with the modified content.
        resolve(root.toString());
      });
    },
  };
};