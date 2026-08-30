package expo.modules.smssender

import android.Manifest
import android.content.pm.PackageManager
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsSenderModule : Module() {

  override fun definition() = ModuleDefinition {

    Name("SmsSender")

    AsyncFunction("sendSms") { phoneNumber: String, message: String ->

      val context = appContext.reactContext
        ?: throw Exception("React context is unavailable")

      val permission = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.SEND_SMS
      )

      if (permission != PackageManager.PERMISSION_GRANTED) {
        throw Exception("SEND_SMS permission not granted")
      }

      if (phoneNumber.isBlank()) {
        throw Exception("Phone number is required")
      }

      if (message.isBlank()) {
        throw Exception("Message is required")
      }

      try {
        val smsManager = SmsManager.getDefault()

        val parts = smsManager.divideMessage(message)

        if (parts.size > 1) {
          smsManager.sendMultipartTextMessage(
            phoneNumber,
            null,
            parts,
            null,
            null
          )
        } else {
          smsManager.sendTextMessage(
            phoneNumber,
            null,
            message,
            null,
            null
          )
        }

        mapOf(
          "success" to true,
          "phoneNumber" to phoneNumber,
          "message" to "SMS submitted to Android SmsManager"
        )
      } catch (e: Exception) {
        throw Exception(
          "Failed to send SMS: ${e.message}",
          e
        )
      }
    }
  }
}