# Vite Plugin Image Sizes

## What it does

This Vite plugin enhances your images by:

1. **Image Optimization**

   - Converts images to WebP format for better performance
   - Uses Sharp library for high-quality compression

2. **Responsive Images**

   - Automatically generates multiple image sizes for different screen widths
   - Creates a `<picture>` element with appropriate `<source>` tags
   - Includes the original image width in the size options
   - Only generates resized versions during production build
   - Uses original images during development for faster builds

3. **Simplified Image Usage**

   - No need to write complex file paths
   - Just use `<img src="image-name.jpg">` and the plugin handles the rest
   - Automatically adds missing `alt` attributes
   - Sets natural image dimensions (width and height)
   - Provides fallback for browsers without `<picture>` support

4. **Performance Optimization**
   - Adds `loading="lazy"` to all images for better page load performance
   - Generates appropriate `srcset` values for responsive images

## Installation

```bash
npm install @kingkongdevs/vite-plugin-image-sizes
# or
yarn add @kingkongdevs/vite-plugin-image-sizes
# or
pnpm add @kingkongdevs/vite-plugin-image-sizes
```

## Quick Start

1. Import the plugin in your `vite.config.js`:

   ```js
   import viteImageSizes from "@kingkongdevs/vite-plugin-image-sizes";
   ```

2. Add it to your Vite config:

   ```js
   export default defineConfig({
     plugins: [
       viteImageSizes({
         outputDir: "dist/assets/images",
         imgInputDir: "src/assets/images",
       }),
     ],
   });
   ```

3. Use images in your HTML:
   ```html
   <img src="my-image.jpg" />
   ```

## Configuration Options

### Basic Options

| Option        | Type     | Default                | Description                                       |
| ------------- | -------- | ---------------------- | ------------------------------------------------- |
| `outputDir`   | string   | `'dist/assets/images'` | Directory where optimized images will be saved    |
| `imgInputDir` | string   | `'src/assets/images'`  | Directory containing your original images         |
| `sizes`       | number[] | `[320, 640, 1024]`     | Array of widths to generate for responsive images |

### Image Attributes

| Attribute | Type    | Default | Description                                   |
| --------- | ------- | ------- | --------------------------------------------- |
| `nosizes` | boolean | `false` | Skip generating multiple sizes for this image |

## Examples

### Development Mode

Input:

```html
<img src="placeholder.png" />
```

Output:

```html
<picture>
  <img
    src="assets/images/placeholder.png"
    alt=""
    width="1900"
    height="1200"
    loading="lazy"
  />
</picture>
```

### Production Build

Input:

```html
<img src="placeholder.png" />
```

Output:

```html
<picture>
  <source
    srcset="
      /assets/images/placeholder-320px.webp   320w,
      /assets/images/placeholder-640px.webp   640w,
      /assets/images/placeholder-1024px.webp 1024w,
      /assets/images/placeholder-1900px.webp 1900w
    "
    type="image/webp"
  />
  <img
    src="assets/images/placeholder.png"
    alt=""
    width="1900"
    height="1200"
    loading="lazy"
  />
</picture>
```

## Notes

- Images are only processed during production builds
- During development, original images are used for faster builds
- The plugin automatically adds the original image width to the sizes array
- All images are converted to WebP format for better performance
- Missing `alt` attributes are automatically added
- Natural image dimensions are automatically set

## Advanced Usage

### Customizing Image Sizes

You can specify custom sizes for your responsive images:

```js
export default defineConfig({
  plugins: [
    viteImageSizes({
      sizes: [480, 768, 1024, 1280, 1920], // Custom breakpoints
    }),
  ],
});
```

### Skipping Size Generation

Add the `nosizes` attribute to skip generating multiple sizes for specific images:

```html
<img src="logo.png" nosizes />
```

### Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp) - will be skipped as it's already optimized
