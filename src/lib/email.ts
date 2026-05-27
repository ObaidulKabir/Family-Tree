type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

type SendEmailResult = { ok: true } | { ok: false; error: string }

function getConfiguredFromAddress() {
  const from = process.env.EMAIL_FROM?.trim()
  return from ? from : null
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  if (!resendApiKey) {
    return { ok: false, error: 'Email service is not configured.' }
  }

  const from = getConfiguredFromAddress()
  if (!from) {
    return { ok: false, error: 'Email service is missing a FROM address.' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  })

  if (!response.ok) {
    return { ok: false, error: 'Failed to send email.' }
  }

  return { ok: true }
}

