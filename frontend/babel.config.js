/* eslint-disable */
module.exports = {
  "compact": true,
  "presets": [
    "@babel/preset-react",
    [
      "@babel/preset-env",
      {
        "modules": "commonjs",
        "useBuiltIns": "entry",
        "targets": {
          "browsers": ["last 2 versions", "ie >= 11"]
        }
      }
    ]
  ],
  "plugins": [
    ["@babel/plugin-proposal-class-properties", { "loose": true }],
    "@babel/plugin-proposal-export-default-from",
    "add-module-exports",
    "react-hot-loader/babel",
    "transform-react-remove-prop-types",
    ["transform-imports", {
      "react-bootstrap": {
        "transform": "react-bootstrap/lib/${member}",
        "preventFullImport": true
      },
      "components/siteComponents": {
        "transform": "components/siteComponents/${member}"
      },
      "components/controls": {
        "transform": "components/controls/${member}"
      },
      "containers": {
        "transform": "containers/${member}/${member}"
      }
    }]
  ]
}
