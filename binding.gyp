{
  "targets": [
    {
      "target_name": "readonly_sqlite",
      "sources": [ "src/readonly_sqlite.cc" ],
      "include_dirs": [
        "/usr/local/include",
        "/opt/homebrew/include"
      ],
      "libraries": [
        "-lsqlite3"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.7"
      },
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1 }
      },
      "conditions": [
        ["OS=='mac'", {
          "libraries": [
            "-L/usr/local/lib",
            "-L/opt/homebrew/lib"
          ]
        }],
        ["OS=='linux'", {
          "libraries": [
            "-L/usr/lib",
            "-L/usr/lib/x86_64-linux-gnu"
          ]
        }]
      ]
    }
  ]
}