# ─────────────────────────────────────────────────────────────────────────
# SES — envío de emails transaccionales (confirmaciones, recordatorios).
#
# En sandbox: solo puede enviar a emails/dominios verificados.
# Solicitar producción en AWS Console → SES → Account Dashboard.
# ─────────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "ses_send" {
  statement {
    sid    = "SesSendEmail"
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ses_send" {
  name        = "${var.name_prefix}-ses-send"
  description = "Permite enviar emails transaccionales vía SES."
  policy      = data.aws_iam_policy_document.ses_send.json
  tags        = var.tags
}
