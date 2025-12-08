#include <node.h>
#include <node_object_wrap.h>
#include <v8.h>
#include <uv.h>
#include <sqlite3.h>
#include <string>
#include <vector>
#include <memory>

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
using v8::Number;
using v8::Boolean;
using v8::Null;
using v8::Persistent;
using v8::Exception;

// Async work structure
struct QueryWork {
    uv_work_t request;
    Persistent<Function> callback;
    
    std::string sql;
    std::vector<std::string> params;
    
    // Results
    bool success;
    std::string error;
    std::vector<std::vector<std::string>> rows;
    std::vector<std::string> columns;
    
    sqlite3* db;
    
    ~QueryWork() {
        callback.Reset();
    }
};

class ReadOnlyDatabase : public node::ObjectWrap {
public:
    static void Init(Local<Object> exports) {
        Isolate* isolate = exports->GetIsolate();
        Local<Context> context = isolate->GetCurrentContext();
        
        // Constructor template
        Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
        tpl->SetClassName(String::NewFromUtf8(isolate, "ReadOnlyDatabase").ToLocalChecked());
        tpl->InstanceTemplate()->SetInternalFieldCount(1);
        
        // Methods
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
        Isolate* isolate = args.GetIsolate();
        
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
        
        // Open with read-only mode (don't use SHAREDCACHE as it can cause concurrency issues)
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
        ReadOnlyDatabase* db = ObjectWrap::Unwrap<ReadOnlyDatabase>(args.Holder());
        
        if (!db->db_) {
            isolate->ThrowException(Exception::Error(
                String::NewFromUtf8(isolate, "Database not open").ToLocalChecked()));
            return;
        }
        
        if (args.Length() < 2 || !args[0]->IsString() || !args[1]->IsFunction()) {
            isolate->ThrowException(Exception::TypeError(
                String::NewFromUtf8(isolate, "SQL and callback required").ToLocalChecked()));
            return;
        }
        
        String::Utf8Value sql(isolate, args[0]);
        Local<Function> callback = Local<Function>::Cast(args[1]);
        
        // Create work request
        QueryWork* work = new QueryWork();
        work->sql = *sql;
        work->db = db->db_;
        work->callback.Reset(isolate, callback);
        
        // Parse params if provided
        if (args.Length() > 2 && args[2]->IsArray()) {
            Local<Array> params = Local<Array>::Cast(args[2]);
            for (uint32_t i = 0; i < params->Length(); i++) {
                Local<Value> val = params->Get(isolate->GetCurrentContext(), i).ToLocalChecked();
                String::Utf8Value str(isolate, val);
                work->params.push_back(*str);
            }
        }
        
        // Set work data in request
        work->request.data = work;
        
        // Queue work
        uv_queue_work(
            uv_default_loop(),
            &work->request,
            ExecuteQuery,
            (uv_after_work_cb)QueryComplete
        );
        
        args.GetReturnValue().Set(args.Holder());
    }
    
    static void ExecuteQuery(uv_work_t* req) {
        QueryWork* work = static_cast<QueryWork*>(req->data);
        
        sqlite3_stmt* stmt;
        int rc = sqlite3_prepare_v2(work->db, work->sql.c_str(), -1, &stmt, nullptr);
        
        if (rc != SQLITE_OK) {
            work->success = false;
            work->error = sqlite3_errmsg(work->db);
            return;
        }
        
        // Bind parameters
        for (size_t i = 0; i < work->params.size(); i++) {
            sqlite3_bind_text(stmt, i + 1, work->params[i].c_str(), -1, SQLITE_TRANSIENT);
        }
        
        // Get column names
        int columnCount = sqlite3_column_count(stmt);
        for (int i = 0; i < columnCount; i++) {
            work->columns.push_back(sqlite3_column_name(stmt, i));
        }
        
        // Execute and fetch results
        while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
            std::vector<std::string> row;
            for (int i = 0; i < columnCount; i++) {
                const char* text = (const char*)sqlite3_column_text(stmt, i);
                row.push_back(text ? text : "");
            }
            work->rows.push_back(row);
        }
        
        sqlite3_finalize(stmt);
        
        work->success = (rc == SQLITE_DONE);
        if (!work->success && rc != SQLITE_DONE) {
            work->error = sqlite3_errmsg(work->db);
        }
    }
    
    static void QueryComplete(uv_work_t* req, int status) {
        Isolate* isolate = Isolate::GetCurrent();
        v8::HandleScope handleScope(isolate);
        Local<Context> context = isolate->GetCurrentContext();
        
        QueryWork* work = static_cast<QueryWork*>(req->data);
        
        // Prepare callback arguments
        Local<Value> argv[2];
        
        if (!work->success) {
            argv[0] = Exception::Error(
                String::NewFromUtf8(isolate, work->error.c_str()).ToLocalChecked());
            argv[1] = Null(isolate);
        } else {
            argv[0] = Null(isolate);
            
            // Build result object
            Local<Object> result = Object::New(isolate);
            
            // Add columns array
            Local<Array> columns = Array::New(isolate, work->columns.size());
            for (size_t i = 0; i < work->columns.size(); i++) {
                columns->Set(context, i, 
                    String::NewFromUtf8(isolate, work->columns[i].c_str()).ToLocalChecked()).FromJust();
            }
            result->Set(context,
                String::NewFromUtf8(isolate, "columns").ToLocalChecked(),
                columns).FromJust();
            
            // Add values array
            Local<Array> values = Array::New(isolate, work->rows.size());
            for (size_t i = 0; i < work->rows.size(); i++) {
                Local<Array> row = Array::New(isolate, work->rows[i].size());
                for (size_t j = 0; j < work->rows[i].size(); j++) {
                    row->Set(context, j,
                        String::NewFromUtf8(isolate, work->rows[i][j].c_str()).ToLocalChecked()).FromJust();
                }
                values->Set(context, i, row).FromJust();
            }
            result->Set(context,
                String::NewFromUtf8(isolate, "values").ToLocalChecked(),
                values).FromJust();
            
            argv[1] = result;
        }
        
        // Call the callback
        Local<Function> callback = Local<Function>::New(isolate, work->callback);
        callback->Call(context, Null(isolate), 2, argv).ToLocalChecked();
        
        // Clean up
        work->callback.Reset();
        delete work;
        // Don't delete req - it's managed by libuv
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

// Initialize the module
void Initialize(Local<Object> exports) {
    ReadOnlyDatabase::Init(exports);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)