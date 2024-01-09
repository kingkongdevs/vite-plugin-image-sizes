# Vite Plugin Image Sizes

## What it does
**Compresses** - Generates the Webp or AVIF version of your images using the Sharp library.

**Generates** - Takes the original image and generates resized versions for common breakpoints like mobile, tablet, desktop etc. Images are only generated on build, during development watch mode the original images are used contained within ```<picture>``` tags.

**Renames with semantic HTML** - No need to write out file paths for your project, just use the image name and type, and this plugin will take care of the rest ```<img src="image-name.jpg">```. Also takes care of adding all srcset image references. If your image doens't have an ```alt``` attribute, it will add it, along with the natural image height and width. Falls back to the original image for browsers without ```<picture>``` and ```<source>``` tag support.

***Lazyloading*** - Adds the lazyload class to all images.

## Usage
Import `viteImageSizes` from `@kingkongdevs/vite-plugin-image-sizes`

```
import viteImageSizes from @kingkongdevs/vite-plugin-image-sizes'
```


Add the viteImageSizes to your `vite.config.js` file's plugins array:
```
plugins: [
  viteImageSizes({
    outputDir: 'dist/assets/images',
    imgInputDir: 'src/assets/images'
  }),
]
```

## Plugin Options
### outputDir
- #### Type: `string`
- #### Default: `'dist/assets/images'`
  The directory where the optimized images will be output.

### imgInputDir
- #### Type: `string`
- #### Default: `'src/assets/images'`
  The directory containing the original images. This is where the plugin will look to process the images from.

### sizes
- #### Type: `array`
- #### Default: `[320, 640, 1024]`
  An array of numbers used to generate resized versions of the images. These will be used to generate the `srcset` values.



## Examples

HTML:
```
<img src="placeholder.png">
```

Dev Output:
```
<picture>
  <img data-src="assets/images/placeholder.png" alt="" width="1900" height="1200" class="lazyload">
</picture>
```

Build Output: 
```
<picture>
  <source data-srcset="/assets/images/placeholder-320px.webp 320w, /assets/images/placeholder-640px.webp 640w, /assets/images/placeholder-1024px.webp 1024w" type="image/webp" />
  <img data-src="assets/images/placeholder.png" alt="" width="1900" height="1200" class="lazyload" />
</picture>
```