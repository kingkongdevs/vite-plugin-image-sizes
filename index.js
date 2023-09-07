const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const { parse, HTMLElement } = require('node-html-parser');

// Create a Set to store processed image paths
const processedImages = new Set();

module.exports = (options) => {
  return {
    name: 'vite-plugin-images',

    configResolved(resolvedConfig) {
      // store the resolved config
      config = resolvedConfig
    },

    async transformIndexHtml(html, { path: indexPath, context }) {
      const imgOutputDir = options.outputDir || 'dist/assets/images'; //  Set the image output directory
      const imgInputDir = options.imgInputDir || 'src/assets/images'; // Set the image input directory
      const configCommand = config.command; // build or serve
      const buildDir = config.build.outDir; // ./dist/ by default
      

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
            const inputImagePath = path.resolve(imgInputDir, src);

            console.log(`Processing image: ${inputImagePath}`);

            // Check if the input image file exists.
            if (fs.existsSync(inputImagePath)) {
              // Process the image if it is build, otherwise just use the original image inside the picture tag
              if(configCommand === 'build') {
              // Check if the image has already been processed
                if (!processedImages.has(inputImagePath)) {
                  // Add the input image path to the processed images Set
                  processedImages.add(inputImagePath);

                  // Get the dimensions of the original image
                  const imageMetadata = await sharp(inputImagePath).metadata();
                  const originalWidth = imageMetadata.width || 0;
                  const originalHeight = imageMetadata.height || 0;

                  // Copy the original image to the output directory
                  const outputImageCopyPath = path.resolve(imgOutputDir, src);
                  await fs.copy(inputImagePath, outputImageCopyPath);
                  console.log(`Copied original image to: ${outputImageCopyPath}`);

                  // Process the image (resize and convert to webp) for sizes smaller than the original
                  const image = sharp(inputImagePath);
                  const sizes = [320, 640, 1024];
                  // Create an array to store the `srcset` values
                  const srcsetValues = [];
                  const imagePromises = sizes.map(async (size) => {
                    if (size <= originalWidth) {
                      // Check if the output image is smaller than the size it is set to output
                      if (image.metadata().width < size || image.metadata().height < size) {
                        // No processing needed, return the original path
                        return;
                      }
                      // Otherwise resize and output the webp format
                      console.log(`Resizing image to ${size}px: ${inputImagePath}`);
                      const webpBuffer = await image.clone().resize(size).toFormat('webp').toBuffer();
                      const webpFileName = `${path.basename(src, path.extname(src))}-${size}px.webp`;

                      // Specify the output directory and file path
                      const outputImagePath = path.resolve(imgOutputDir, webpFileName);

                      // Ensure that parent directories are created if they don't exist.
                      await fs.ensureDir(path.dirname(outputImagePath));

                      await fs.outputFile(outputImagePath, webpBuffer);
                      console.log(`Generated WebP image: ${outputImagePath}`);

                      srcsetValues.push(`${outputImagePath} ${size}w`);
                      return `${outputImagePath} ${size}w`;
                    }
                  });

                  // Wait for all promises to resolve
                  Promise.all(imagePromises).then((srcsetValues) => {
                    // Filter out empty strings or placeholders
                    srcsetValues = srcsetValues.filter((value) => value !== '');

                    // Create the html element for <source> with each image reference in it
                    const pictureSource = new HTMLElement('source', {});
                    if(!imgTag.classList.contains('nolazy')) {
                      pictureSource.setAttribute('data-srcset', srcsetValues.join(', '));
                    } else {
                      pictureSource.setAttribute('srcset', srcsetValues.join(', '));
                    }
                    pictureSource.setAttribute('type', 'image/webp');
                    // Add the picture source elements to the img tag
                    imgTag.appendChild(pictureSource);
                  });

                  imageProcessingPromises.push(...imagePromises);
                } else {
                  console.log(`Image already processed: ${inputImagePath}`);
                }
              }

              // Calculate the relative path from the HTML file to the new image in /dist/
              const relativeImagePath = path.relative(path.dirname(indexPath), path.join('/', imgOutputDir, src));

              // Remove the /dist/ folder from the relative path
              const cleanRelativeImagePath = relativeImagePath.replace('dist/', ''); // TODO: replace this with something that doesnt assume your output folder is dist

              console.log('Updated image src:', cleanRelativeImagePath);

              // Update the src attribute of the <img> tag with the cleaned relative path
              if(!imgTag.classList.contains('nolazy')) {
                imgTag.setAttribute('data-src', cleanRelativeImagePath);
              } else {
                imgTag.setAttribute('src', cleanRelativeImagePath);
              }
              
              // Clone the image and add it as a child of the original image
              const ogImage = imgTag.clone();
              imgTag.appendChild(ogImage);
              
              // If the ogImage does not have an alt attribute, add one
              const altTag = ogImage.getAttribute('alt');
              if(!altTag) {
                ogImage.setAttribute('alt','');
              }
              const imageMetadata = await sharp(inputImagePath).metadata();
              const originalWidth = imageMetadata.width || 0;
              const originalHeight = imageMetadata.height || 0;
              // Set the ogImage height and width to the natural height and width of the image 
              ogImage.setAttribute('width', originalWidth);
              ogImage.setAttribute('height', originalHeight);
              // If the image tag has the nolazy class, don't add lazyload class, and use src instead of data-src
              if(!ogImage.classList.contains('nolazy')) {
                // Add lazyload class to img tag
                ogImage.setAttribute('class', 'lazyload');
                ogImage.removeAttribute('src');
              } else {
              }

              // Set the container image to a picture tag and remove the src attribute
              imgTag.rawTagName = 'picture';
              imgTag.removeAttribute('src');
              imgTag.removeAttribute('data-src');

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