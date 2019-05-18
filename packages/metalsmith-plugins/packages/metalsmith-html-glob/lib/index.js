const cheerio = require('cheerio');
const deepmerge = require('deepmerge');
const minimatch = require('minimatch');
const url = require('url');

module.exports = (options) => {
  options = deepmerge({
    html: '**/*.html',
    tags: {
      a: 'href',
      img: 'src',
      link: 'href',
      script: 'src',
    },
  }, options || {});

  return (files, metalsmith, done) => {
    // For each HTML file that matches the given pattern
    Object.keys(files)
      .filter(minimatch.filter(options.html))
      .forEach((filename) => {
        const file = files[filename];

        // For each given tag
        const $ = cheerio.load(file.contents);
        Object.keys(options.tags)
          .forEach((tag) => {
            const attribute = options.tags[tag];
            const selector = `${tag}[${attribute}][${attribute}!='']`;

            // For each matching element for the tag in the file
            $(selector).each((i, elem) => {
              const resourceGlob = $(elem).attr(attribute);

              // Ignore non-local resources
              const resourceURL = url.parse(resourceGlob);
              if (resourceURL.protocol) {
                return;
              }

              // Get rid of leading slash
              const relativeGlob = resourceGlob.replace(/^\//, '');

              // Ignore resources that already resolve successfully
              if (relativeGlob in files) {
                return;
              }

              // Find all input files matching the glob in the tag
              const resources = Object.keys(files)
                .filter(minimatch.filter(relativeGlob))
                .map(resource => $(elem).clone().attr(attribute, resource));

              // If files are found, add them and remove the original tag
              if (resources.length) {
                resources
                  .forEach((resource) => {
                    resource.insertBefore($(elem));
                  });
                $(elem).remove();
              }
            });
          });

        file.contents = Buffer.from($.html());
      });

    done();
  };
};