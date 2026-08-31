package expo.modules.captacaoforeground

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Serviço em primeiro plano que mantém a captação viva com a tela apagada
 * (ADR-0052, parte 2).
 *
 * O serviço **não fala com o aparelho**: quem mantém o socket e o stream é o
 * JavaScript, no `CaptureSession`. O papel dele é impedir que o Android
 * suspenda o processo quando o app sai da tela — que é a única razão pela qual
 * a captação parava.
 *
 * O tipo é `connectedDevice`, obrigatório a partir do Android 14 (API 34) para
 * serviços que sustentam conexão com aparelho externo. Como pré-requisito de
 * runtime o sistema exige BLUETOOTH_CONNECT ou BLUETOOTH_SCAN concedida — as
 * duas que o app já pede antes de qualquer varredura.
 *
 * A notificação é **obrigatória e não pode ser escondida**: é o preço que o
 * Android cobra por deixar o app rodar fora da tela. Por isso ela diz o que
 * está acontecendo sem eufemismo, em vez de tentar se disfarçar.
 */
class CaptacaoService : Service() {

  companion object {
    const val CANAL = "waveai.captacao"
    const val ID_NOTIFICACAO = 1042

    fun iniciar(contexto: Context) {
      val intent = Intent(contexto, CaptacaoService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        contexto.startForegroundService(intent)
      } else {
        contexto.startService(intent)
      }
    }

    fun parar(contexto: Context) {
      contexto.stopService(Intent(contexto, CaptacaoService::class.java))
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    criarCanal()
    val notificacao = construirNotificacao()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // A partir do Android 14 o tipo é obrigatório na chamada, e não só no
      // manifesto; sem ele o sistema derruba o serviço.
      startForeground(
        ID_NOTIFICACAO,
        notificacao,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
      )
    } else {
      startForeground(ID_NOTIFICACAO, notificacao)
    }

    // START_NOT_STICKY: se o sistema matar o processo, **não** ressuscitamos o
    // serviço. Ele sozinho não capta nada — o dono do socket é o JavaScript, que
    // morreu junto. Ressuscitar deixaria uma notificação mentindo que há
    // captação em curso (ADR-0027).
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    // `removeNotification = true`: a notificação some junto com o serviço. Sem
    // isto ela poderia sobreviver ao fim da captação.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    super.onDestroy()
  }

  private fun criarCanal() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val gerenciador = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (gerenciador.getNotificationChannel(CANAL) != null) return

    val canal = NotificationChannel(
      CANAL,
      "Captação em andamento",
      // LOW: sem som e sem vibração. A notificação precisa existir, não
      // interromper — quem está captando pediu calma.
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Avisa enquanto o WaveAI está captando com a tela apagada."
      setShowBadge(false)
    }
    gerenciador.createNotificationChannel(canal)
  }

  private fun construirNotificacao(): Notification {
    // Tocar na notificação volta para o app, em vez de abrir uma tela em
    // branco: o Intent é o de abrir a própria aplicação.
    val abrir = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendente = abrir?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    return NotificationCompat.Builder(this, CANAL)
      .setContentTitle("Captação em andamento")
      .setContentText("O WaveAI está registrando sua sessão.")
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(pendente)
      .build()
  }
}
