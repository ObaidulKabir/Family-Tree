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

async function readResendErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as unknown
    if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
      return payload.message
    }
  } catch {
    // ignore
  }

  try {
    const text = await response.text()
    if (text) return text.slice(0, 400)
  } catch {
    // ignore
  }

  return null
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  if (!resendApiKey) {
    return { ok: false, error: 'Email service is not configured (missing RESEND_API_KEY).' }
  }

  const from = getConfiguredFromAddress()
  if (!from) {
    return { ok: false, error: 'Email service is missing a FROM address (missing EMAIL_FROM).' }
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
    const details = await readResendErrorMessage(response)
    const prefix = `Failed to send email (${response.status} ${response.statusText}).`
    return { ok: false, error: details ? `${prefix} ${details}` : prefix }
  }

  return { ok: true }
}

