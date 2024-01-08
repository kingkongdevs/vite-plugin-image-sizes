const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const { parse, HTMLElement } = require('node-html-parser');
// TODO: probably create a webp version of the original image for the largest size
// TODO: do something with avif as well
// TODO: add a global that stops lazyloading from being added
// TODO: generate the source and srcset even if new images arent generated.
// TODO: <source> elements should appear first in the <picture> with <img> fallback last.

// Create a Set to store processed image paths
const processedImages = new Set();

module.exports = (options) => {
  return {
    name: 'vite-plugin-image-sizes',

    configResolved(resolvedConfig) {
      // store the resolved config
      config = resolvedConfig
    },

    async transformIndexHtml(html, { path: indexPath, context, filename }) {
      const imgOutputDir = options.outputDir || 'dist/assets/images'; //  Set the image output directory
      const imgOutDir = 'assets/images';
      const imgInputDir = options.imgInputDir || 'src/assets/images'; // Set the image input directory
      const configCommand = config.command; // build or serve
      const buildDir = config.build.outDir; // dist by default
      const sizes = options.sizes || [320, 640, 1024];
      const configRoot = config.root; // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/src
      const currentFilePath = indexPath;  // ex. /free-ebook/index.html
      const projectPath = process.cwd(); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin
      const outputDir = config.build.outDir; // ex. ../dist/
      const outputPath = path.join(configRoot, outputDir); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/dist
      const imgOutputPath = path.resolve(outputPath, imgOutDir); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/dist/
      // Subtract the output directory path from the image output path to get the relative path
      const webOutputPath = path.relative(outputPath, imgOutputPath); // ex. assets/images
      // Get the directory path that the currently processed HTML file is in
      const currentHTMLdir = path.dirname(path.join(outputPath, currentFilePath)); // ex. /Users/myuser/Documents/boilerplate-vite-image-plugin/dist


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

            // First generate the picture element and rename the file
            const picture = new HTMLElement('picture',{});
            imgTag.replaceWith(picture);
  
            // Add the original image as a child of the new picture tag
            picture.appendChild(imgTag);


            // Output the src of the image when it gets output relative to the HTML file that is being processed
            const currentIMGpath = path.join(imgOutputPath, src);
            const outputImagePath = path.relative(currentHTMLdir, currentIMGpath);

            // Construct the full path to the input image based on /src/assets/images
            const inputImagePath = path.resolve(imgInputDir, src);

            // Update the src attribute of the <img> tag with the cleaned relative path
            if (!imgTag.classList.contains('nolazy')) {
              imgTag.setAttribute('data-src', outputImagePath);
            } else {
              imgTag.setAttribute('src', outputImagePath);
            }

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

            // If the image tag has the 'nolazy' class, remove src and add lazyload class
            if (!imgTag.classList.contains('nolazy')) {
              const existingClass = [imgTag.getAttribute('class')];
              existingClass.push('lazyload');
              imgTag.setAttribute('class', existingClass.join(' '));
              imgTag.removeAttribute('src');
            }



            console.log(`Processing image: ${inputImagePath}`);

            // Check if the input image file exists.
            if (fs.existsSync(inputImagePath)) {
              // Process the image if it is build, otherwise just use the original image inside the picture tag
              if(configCommand === 'build' && !imgTag.hasAttribute('nosizes')) {
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

                      // Generate the relative href for the image to output to the HTML
                      const outputImageSrc = path.relative(currentHTMLdir, outputImagePath);

                      srcsetValues.push(`${outputImageSrc} ${size}w`);
                      return `${outputImageSrc} ${size}w`;
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
                    picture.insertAdjacentHTML('afterbegin',pictureSource);
                  });

                  imageProcessingPromises.push(...imagePromises);
                } else {
                  console.log(`Image already processed: ${inputImagePath}`);
                }
              }

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