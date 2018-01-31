/*
 * grunt-cli
 * http://gruntjs.com/
 *
 * Copyright (c) 2016 Tyler Kellen, contributors
 * Licensed under the MIT license.
 * https://github.com/gruntjs/grunt-init/blob/master/LICENSE-MIT
 */

'use strict';

// Nodejs libs.
let fs = require('fs');
let path = require('path');

exports.print = function(name) {
  let code = 0;
  let filepath = path.join(__dirname, '../completion', name);
  let output;
  try {
    // Attempt to read shell completion file.
    output = String(fs.readFileSync(filepath));
  } catch (err) {
    code = 5;
    output = 'echo "Specified grunt shell auto-completion rules ';
    if (name && name !== 'true') {
      output += 'for \'' + name + '\' ';
    }
    output += 'not found."';
  }

  console.log(output);
  process.exit(code);
};
