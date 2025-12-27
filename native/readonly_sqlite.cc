#include <node.h>
#include <node_object_wrap.h>
#include <v8.h>
#include <sqlite3.h>
#include <string>
#include <vector>

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;
using v8::Array;
using v8::Boolean;
using v8::Exception;

class ReadOnlyDatabase : public node::ObjectWrap {
public:
    static void Init(Local<Object> exports) {
        Isolate* isolate = exports->GetIsolate();
        Local<Context> context = isolate->GetCurrentContext();

        Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
        tpl->SetClassName(String::NewFromUtf8(isolate, "ReadOnlyDatabase").ToLocalChecked());
        tpl->InstanceTemplate()->SetInternalFieldCount(1);

        NODE_SET_PROTOTYPE_METHOD(tpl, "open", Open);
        NODE_SET_PROTOTYPE_METHOD(tpl, "query", Query);
        NODE_SET_PROTOTYPE_METHOD(tpl, "close", Close);

        exports->Set(context,
            String::NewFromUtf8(isolate, "ReadOnlyDatabase").ToLocalChecked(),
            tpl->GetFunction(context).ToLocalChecked()).FromJust();
    }

private:
    explicit ReadOnlyDatabase() : db_(nullptr) {}
    ~ReadOnlyDatabase() {
        if (db_) {
            sqlite3_close(db_);
        }
    }

    static void New(const FunctionCallbackInfo<Value>& args) {
        if (args.IsConstructCall()) {
            ReadOnlyDatabase* obj = new ReadOnlyDatabase();
            obj->Wrap(args.This());
            args.GetReturnValue().Set(args.This());
        }
    }

    static void Open(const FunctionCallbackInfo<Value>& args) {
        Isolate* isolate = args.GetIsolate();
        ReadOnlyDatabase* db = ObjectWrap::Unwrap<ReadOnlyDatabase>(args.Holder());

        if (args.Length() < 1 || !args[0]->IsString()) {
            isolate->ThrowException(Exception::TypeError(
                String::NewFromUtf8(isolate, "Path required").ToLocalChecked()));
            return;
        }

        String::Utf8Value path(isolate, args[0]);

        int rc = sqlite3_open_v2(
            *path,
            &db->db_,
            SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX,
            nullptr
        );

        if (rc != SQLITE_OK) {
            std::string error = sqlite3_errmsg(db->db_);
            sqlite3_close(db->db_);
            db->db_ = nullptr;
            isolate->ThrowException(Exception::Error(
                String::NewFromUtf8(isolate, error.c_str()).ToLocalChecked()));
            return;
        }

        // Set pragmas for optimal read performance
        sqlite3_exec(db->db_, "PRAGMA journal_mode=OFF", nullptr, nullptr, nullptr);
        sqlite3_exec(db->db_, "PRAGMA synchronous=OFF", nullptr, nullptr, nullptr);
        sqlite3_exec(db->db_, "PRAGMA cache_size=-64000", nullptr, nullptr, nullptr);
        sqlite3_exec(db->db_, "PRAGMA mmap_size=268435456", nullptr, nullptr, nullptr);
        sqlite3_exec(db->db_, "PRAGMA temp_store=MEMORY", nullptr, nullptr, nullptr);
        sqlite3_exec(db->db_, "PRAGMA query_only=ON", nullptr, nullptr, nullptr);

        args.GetReturnValue().Set(Boolean::New(isolate, true));
    }

    static void Query(const FunctionCallbackInfo<Value>& args) {
        Isolate* isolate = args.GetIsolate();
        Local<Context> context = isolate->GetCurrentContext();
        ReadOnlyDatabase* db = ObjectWrap::Unwrap<ReadOnlyDatabase>(args.Holder());

        if (!db->db_) {
            isolate->ThrowException(Exception::Error(
                String::NewFromUtf8(isolate, "Database not open").ToLocalChecked()));
            return;
        }

        if (args.Length() < 1 || !args[0]->IsString()) {
            isolate->ThrowException(Exception::TypeError(
                String::NewFromUtf8(isolate, "SQL required").ToLocalChecked()));
            return;
        }

        String::Utf8Value sql(isolate, args[0]);

        sqlite3_stmt* stmt;
        int rc = sqlite3_prepare_v2(db->db_, *sql, -1, &stmt, nullptr);

        if (rc != SQLITE_OK) {
            std::string error = sqlite3_errmsg(db->db_);
            isolate->ThrowException(Exception::Error(
                String::NewFromUtf8(isolate, error.c_str()).ToLocalChecked()));
            return;
        }

        // Bind parameters if provided
        if (args.Length() > 1 && args[1]->IsArray()) {
            Local<Array> params = Local<Array>::Cast(args[1]);
            for (uint32_t i = 0; i < params->Length(); i++) {
                Local<Value> val = params->Get(context, i).ToLocalChecked();
                String::Utf8Value str(isolate, val);
                sqlite3_bind_text(stmt, i + 1, *str, -1, SQLITE_TRANSIENT);
            }
        }

        // Get column names
        int columnCount = sqlite3_column_count(stmt);
        Local<Array> columns = Array::New(isolate, columnCount);
        for (int i = 0; i < columnCount; i++) {
            columns->Set(context, i,
                String::NewFromUtf8(isolate, sqlite3_column_name(stmt, i)).ToLocalChecked()).FromJust();
        }

        // Execute and fetch results
        std::vector<std::vector<std::string>> rows;
        while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
            std::vector<std::string> row;
            for (int i = 0; i < columnCount; i++) {
                const char* text = (const char*)sqlite3_column_text(stmt, i);
                row.push_back(text ? text : "");
            }
            rows.push_back(row);
        }

        sqlite3_finalize(stmt);

        if (rc != SQLITE_DONE) {
            std::string error = sqlite3_errmsg(db->db_);
            isolate->ThrowException(Exception::Error(
                String::NewFromUtf8(isolate, error.c_str()).ToLocalChecked()));
            return;
        }

        // Build result object
        Local<Object> result = Object::New(isolate);
        result->Set(context,
            String::NewFromUtf8(isolate, "columns").ToLocalChecked(),
            columns).FromJust();

        // Add values array
        Local<Array> values = Array::New(isolate, rows.size());
        for (size_t i = 0; i < rows.size(); i++) {
            Local<Array> row = Array::New(isolate, rows[i].size());
            for (size_t j = 0; j < rows[i].size(); j++) {
                row->Set(context, j,
                    String::NewFromUtf8(isolate, rows[i][j].c_str()).ToLocalChecked()).FromJust();
            }
            values->Set(context, i, row).FromJust();
        }
        result->Set(context,
            String::NewFromUtf8(isolate, "values").ToLocalChecked(),
            values).FromJust();

        args.GetReturnValue().Set(result);
    }

    static void Close(const FunctionCallbackInfo<Value>& args) {
        Isolate* isolate = args.GetIsolate();
        ReadOnlyDatabase* db = ObjectWrap::Unwrap<ReadOnlyDatabase>(args.Holder());

        if (db->db_) {
            sqlite3_close(db->db_);
            db->db_ = nullptr;
        }

        args.GetReturnValue().Set(Boolean::New(isolate, true));
    }

    sqlite3* db_;
};

NODE_MODULE_INIT() {
    ReadOnlyDatabase::Init(exports);
}
