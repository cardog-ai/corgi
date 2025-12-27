{
  "targets": [
    {
      "target_name": "readonly_sqlite",
      "sources": [
        "native/readonly_sqlite.cc"
      ],
      "cflags_cc": [
        "-std=c++17"
      ],
      "conditions": [
        [
          "OS=='mac'",
          {
            "libraries": [
              "-lsqlite3"
            ],
            "xcode_settings": {
              "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
              "CLANG_CXX_LIBRARY": "libc++",
              "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
              "MACOSX_DEPLOYMENT_TARGET": "10.13"
            }
          }
        ],
        [
          "OS=='linux'",
          {
            "libraries": [
              "-lsqlite3"
            ],
            "cflags_cc": [
              "-fexceptions",
              "-std=c++17"
            ]
          }
        ],
        [
          "OS=='win'",
          {
            "libraries": [
              "sqlite3.lib"
            ],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "AdditionalOptions": [
                  "/std:c++17"
                ]
              }
            }
          }
        ]
      ]
    }
  ]
}
