{
  "targets": [
    {
      "target_name": "readonly_sqlite",
      "sources": [
        "native/readonly_sqlite.cc"
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
              "-std=c++14"
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
                "ExceptionHandling": 1
              }
            }
          }
        ]
      ]
    }
  ]
}
