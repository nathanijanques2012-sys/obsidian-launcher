const glob = require('glob');
glob('renderer/**/*', { nodir: true }, (er, files) => {
  console.log('Files matched:');
  files.forEach(f => console.log(f));
});