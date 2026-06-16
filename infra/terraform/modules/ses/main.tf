# ─────────────────────────────────────────────────────────────────────────
# SES — transactional email sending (confirmations, reminders).
#
# In sandbox: can only send to verified emails/domains.
# Request production access in AWS Console → SES → Account Dashboard.
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
  description = "Allows sending transactional emails via SES."
  policy      = data.aws_iam_policy_document.ses_send.json
  tags        = var.tags
}
