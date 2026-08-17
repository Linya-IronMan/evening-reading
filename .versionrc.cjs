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

const cargoLockUpdater = {
  readVersion: function (contents) {
    const match = contents.match(/name\s*=\s*"evening_reading_lib"\s*\nversion\s*=\s*"([^"]+)"/);
    return match ? match[1] : null;
  },
  writeVersion: function (contents, version) {
    return contents.replace(
      /(name\s*=\s*"evening_reading_lib"\s*\nversion\s*=\s*")[^"]+(")/,
      `$1${version}$2`
    );
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
    },
    {
      filename: 'src-tauri/Cargo.lock',
      updater: cargoLockUpdater
    }
  ],
  scripts: {
    postbump: 'cargo check --manifest-path src-tauri/Cargo.toml'
  }
};
