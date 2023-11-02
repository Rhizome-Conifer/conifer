/* eslint-disable */
module.exports = {
  "compact": true,
  "presets": [
    "@babel/preset-react",
    [
      "@babel/preset-env",
      {
        "modules": "commonjs",
        "targets": {
          "browsers": ["last 2 versions", "ie > 11"]
        }
      }
    ]
  ],
  "plugins": [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-private-methods",
    "@babel/plugin-transform-react-jsx",
    "@babel/plugin-proposal-export-default-from",
    "@babel/plugin-transform-runtime",
    "add-module-exports",
    "react-hot-loader/babel",
    "transform-react-remove-prop-types",
    ["transform-imports", {
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
