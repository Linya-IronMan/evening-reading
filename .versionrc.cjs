const fs = require('fs');

const cargoTomlUpdater = {
  readVersion: function (contents) {
    const match = contents.match(/version\s*=\s*"([^"]+)"/);
    return match ? match[1] : null;
  },
  writeVersion: function (contents, version) {
    // Only replace the first occurrence of version = "..." which is under [package]
    return contents.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
  }
};

module.exports = {
  bumpFiles: [
    {
      filename: 'package.json',
      type: 'json'
    },
    {
      filename: 'src-tauri/tauri.conf.json',
      type: 'json'
    },
    {
      filename: 'src-tauri/Cargo.toml',
      updater: cargoTomlUpdater
    }
  ]
};
