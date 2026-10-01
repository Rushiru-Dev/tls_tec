package com.tls_tec

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class BackupFilePickerModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  private var pickerPromise: Promise? = null

  private val activityEventListener =
      object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?,
        ) {
          if (requestCode != REQUEST_CODE) return

          val promise = pickerPromise ?: return
          pickerPromise = null

          if (resultCode != Activity.RESULT_OK) {
            promise.reject("E_PICKER_CANCELLED", "Backup file selection was cancelled.")
            return
          }

          val uri: Uri = data?.data ?: run {
            promise.reject("E_PICKER_EMPTY", "No backup file was selected.")
            return
          }

          try {
            val destination = File(context.cacheDir, "tls_tec_import_backup.db")
            context.contentResolver.openInputStream(uri).use { input ->
              if (input == null) throw IllegalStateException("Could not read the selected file.")
              FileOutputStream(destination).use { output -> input.copyTo(output) }
            }
            promise.resolve(destination.absolutePath)
          } catch (error: Exception) {
            promise.reject("E_BACKUP_READ", "Could not read the selected backup file.", error)
          }
        }
      }

  init {
    context.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "BackupFilePicker"

  @ReactMethod
  fun pickBackupFile(promise: Promise) {
    if (pickerPromise != null) {
      promise.reject("E_PICKER_BUSY", "A file selection is already in progress.")
      return
    }

    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "The app is not ready to open the file picker.")
      return
    }

    pickerPromise = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(
          Intent.EXTRA_MIME_TYPES,
          arrayOf("application/octet-stream", "application/vnd.sqlite3", "application/x-sqlite3"),
      )
    }
    try {
      activity.startActivityForResult(intent, REQUEST_CODE)
    } catch (error: Exception) {
      pickerPromise = null
      promise.reject("E_PICKER_OPEN", "Could not open the phone file picker.", error)
    }
  }

  companion object {
    private const val REQUEST_CODE = 7412
  }
}
