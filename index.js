const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const { parse, HTMLElement } = require('node-html-parser');
const { normalizePath } = require('vite');

// Create a Map to store processed image paths
const processedImages = new Map();

module.exports = (options) => {
  return {
    name: 'vite-plugin-image-sizes',

    configResolved(resolvedConfig) {
      // store the resolved config
      config = resolvedConfig;
    },

    async transformIndexHtml(html, { path: indexPath, context, filename }) {
      const imgOutputDir = options.outputDir || 'dist/assets/images'; // Set the image output directory
      const imgInputDir = options.imgInputDir || 'src/assets/images'; // Set the image input directory
      const configCommand = config.command; // build or serve
      const sizes = options.sizes || [320, 640, 1024];
      const configRoot = normalizePath(config.root); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/src
      const currentFilePath = normalizePath(indexPath);  // ex. /free-ebook/index.html
      const projectPath = normalizePath(process.cwd()); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin
      const outputDir = normalizePath(config.build.outDir); // ex. ../dist/
      const outputPath = path.posix.join(configRoot, outputDir); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/dist
      const imgOutputPath = normalizePath(path.posix.join(projectPath, imgOutputDir)); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/dist/
      // Get the directory path that the currently processed HTML file is in
      const currentHTMLdir = normalizePath(path.posix.dirname(path.posix.join(outputPath, currentFilePath))); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/dist

      return new Promise(async (resolve, reject) => {
        try {
          // Parse the HTML content.
          const root = parse(html);

          // Find all <img> tags in the HTML.
          const imgTags = root.querySelectorAll('img');

          // Create an array to store image processing promises
          const imageProcessingPromises = [];

          // Process each <img> tag.
          for (const imgTag of imgTags) {
            try {
              const src = imgTag.getAttribute('src');

              // Output the src of the image when it gets output relative to the HTML file that is being processed
              const currentIMGpath = normalizePath(path.posix.join(imgOutputPath, src));
              const outputImagePath = normalizePath(path.posix.relative(currentHTMLdir, currentIMGpath));

              // Construct the full path to the input image based on /src/assets/images
              const inputImagePath = normalizePath(path.posix.resolve(imgInputDir, src));

              // Update the src attribute of the <img> tag with the cleaned relative path
              if (!imgTag.classList.contains('nolazy')) {
                imgTag.setAttribute('data-src', outputImagePath);
              } else {
                imgTag.setAttribute('src', outputImagePath);
              }

              // If the image tag has the 'nolazy' class, remove src and add lazyload class
              if (!imgTag.classList.contains('nolazy')) {
                const existingClass = [imgTag.getAttribute('class')];
                existingClass.push('lazyload');
                imgTag.setAttribute('class', existingClass.join(' '));
                imgTag.removeAttribute('src');
              }

              // Skip if it is not a jpg, jpeg, or png
              if (!src || !/\.(jpg|png|jpeg)$/.test(src)) {
                // Still copy the file if it exists, and is build, and the image has not already been moved
                if (fs.existsSync(inputImagePath) && configCommand === 'build' && !processedImages.has(inputImagePath)) {
                  // Add the input image path to the processed images Set
                  processedImages.set(inputImagePath, []);

                  // Copy the original image to the output directory
                  const outputImageCopyPath = normalizePath(path.posix.resolve(imgOutputDir, src));
                  await fs.copy(inputImagePath, outputImageCopyPath);
                }
                continue; // Skip to the next image if the current one is not a supported format
              }

              // First generate the picture element and rename the file
              const picture = new HTMLElement('picture', {});
              imgTag.replaceWith(picture);

              // Add the original image as a child of the new picture tag
              picture.appendChild(imgTag);

              // If the ogImage does not have an alt attribute, add one
              if (!imgTag.getAttribute('alt')) {
                imgTag.setAttribute('alt', '');
              }

              // Get image metadata
              const imageMetadata = await sharp(inputImagePath).metadata();
              const originalWidth = imageMetadata.width || 0;
              const originalHeight = imageMetadata.height || 0;

              // Set the imgTag height and width to the natural height and width of the image
              imgTag.setAttribute('width', originalWidth);
              imgTag.setAttribute('height', originalHeight);

              // Check if the input image file exists.
              if (!fs.existsSync(inputImagePath)) {
                throw new Error(`Input file is missing: ${inputImagePath}`);
              }

              // Process the image if it is build, otherwise just use the original image inside the picture tag
              if (configCommand === 'build') {
                // Check if the image has already been processed
                if (!processedImages.has(inputImagePath)) {
                  // Add the input image path to the processed images Set
                  processedImages.set(inputImagePath, []);

                  // Copy the original image to the output directory
                  const outputImageCopyPath = normalizePath(path.posix.resolve(imgOutputDir, src));
                  await fs.copy(inputImagePath, outputImageCopyPath);

                  // If the image is flagged as no sizes, don't generate the other sizes
                  if (!imgTag.hasAttribute('nosizes')) {
                    // Get the dimensions of the original image
                    const imageMetadata = await sharp(inputImagePath).metadata();
                    const originalWidth = imageMetadata.width || 0;
                    const originalHeight = imageMetadata.height || 0;

                    // Process the image (resize and convert to webp) for sizes smaller than the original
                    const image = sharp(inputImagePath);

                    // Add the current image size to the sizes to generate
                    let sizesToGenerate = [...sizes];
                    sizesToGenerate.push(originalWidth);

                    const imagePromises = sizesToGenerate.map(async (size) => {
                      if (size <= originalWidth) {
                        // Check if the output image is smaller than the size it is set to output
                        if (image.metadata().width < size || image.metadata().height < size) {
                          // No processing needed, return the original path
                          return;
                        }
                        // Otherwise resize and output the webp format
                        const webpBuffer = await image.clone().resize(size).toFormat('webp').toBuffer();
                        const webpFileName = `${path.basename(src, path.extname(src))}-${size}px.webp`;

                        // Specify the output directory and file path
                        const outputImagePath = normalizePath(path.posix.resolve(imgOutputDir, webpFileName));

                        // Ensure that parent directories are created if they don't exist.
                        await fs.ensureDir(path.posix.dirname(outputImagePath));

                        await fs.outputFile(outputImagePath, webpBuffer);
                        console.log(`Generated WebP image: ${outputImagePath}`);

                        processedImages.get(inputImagePath).push({ 'src': webpFileName, 'size': size });

                        return;
                      }
                    });

                    // Wait for all promises to resolve
                    Promise.all(imagePromises).then(() => {
                      generatePictureTags(inputImagePath);
                    });

                    imageProcessingPromises.push(...imagePromises);
                  }
                } else {
                  // Image already processed, just generate the HTML and insert it based on the stored image data
                  generatePictureTags(inputImagePath);
                }

                async function generatePictureTags(inputImagePath) {
                  // Function that takes the current html directory, the image filename, and the image output directory, and outputs the relative image url
                  let imgPath = (htmlDir, imgName, imgDir) => {
                    return normalizePath(path.relative(htmlDir, path.resolve(imgDir, imgName)));
                  }
                  let imgSizes = processedImages.get(inputImagePath);
                  let outputString = imgSizes.map(image => `${imgPath(currentHTMLdir, image.src, imgOutputDir)} ${image.size}w`).join(', ');

                  // Create the html element for <source> with each image reference in it
                  const pictureSource = new HTMLElement('source', {});
                  if (!imgTag.classList.contains('nolazy')) {
                    pictureSource.setAttribute('data-srcset', outputString);
                  } else {
                    pictureSource.setAttribute('srcset', outputString);
                  }
                  pictureSource.setAttribute('type', 'image/webp');
                  // Add the picture source elements to the img tag
                  picture.insertAdjacentHTML('afterbegin', pictureSource);
                }
              }
            } catch (error) {
              console.error(`Error processing image ${imgTag.getAttribute('src')}: ${error.message}`);
            }
          }

          // Wait for all image processing promises to complete
          await Promise.all(imageProcessingPromises);

          // Update the HTML code with the modified content.
          resolve(root.toString());
        } catch (error) {
          console.error(`Error transforming HTML: ${error.message}`);
          resolve(html); // Resolve with the original HTML in case of an error
        }
      });
    },
  };
};
