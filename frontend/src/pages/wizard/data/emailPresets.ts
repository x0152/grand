import type { BrandLogoSpec } from '../components/brandLogo'
import { EMAIL_PROVIDER_BRANDS } from '../components/brandSpecs'

export type EmailProviderId = 'gmail' | 'yandex' | 'icloud' | 'outlook'

export interface EmailProviderStep {
  text: string
  href?: string
  linkLabel?: string
  tail?: string
}

export interface EmailProviderPreset {
  id: EmailProviderId
  label: string
  brand: BrandLogoSpec
  smtpHost: string
  smtpPort: string
  imapHost: string
  imapPort: string
  hostsLabel: string
  steps: EmailProviderStep[]
}

export const EMAIL_PRESETS: EmailProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    brand: EMAIL_PROVIDER_BRANDS.gmail,
    smtpHost: 'smtp.gmail.com',
    smtpPort: '465',
    imapHost: 'imap.gmail.com',
    imapPort: '993',
    hostsLabel: 'smtp.gmail.com:465 · imap.gmail.com:993',
    steps: [
      {
        text: 'Turn on ',
        href: 'https://myaccount.google.com/signinoptions/two-step-verification',
        linkLabel: '2-Step Verification',
        tail:
          ' on your Google account — without it the App Passwords page is hidden.',
      },
      {
        text:
          'In Gmail open ⚙ Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP → Save. ',
        href: 'https://support.google.com/mail/answer/7126229',
        linkLabel: 'Google guide',
      },
      {
        text: 'Generate a 16-character ',
        href: 'https://myaccount.google.com/apppasswords',
        linkLabel: 'App Password',
        tail: ' and paste it as the password below.',
      },
    ],
  },
  {
    id: 'yandex',
    label: 'Yandex',
    brand: EMAIL_PROVIDER_BRANDS.yandex,
    smtpHost: 'smtp.yandex.com',
    smtpPort: '465',
    imapHost: 'imap.yandex.com',
    imapPort: '993',
    hostsLabel: 'smtp.yandex.com:465 · imap.yandex.com:993',
    steps: [
      {
        text:
          'In Yandex Mail open ⚙ Settings → Email clients, enable "From the imap.yandex.com server via IMAP" and "App passwords and OAuth tokens". ',
        href: 'https://yandex.com/support/yandex-360/customers/mail/en/mail-clients/microsoft-outlook',
        linkLabel: 'Yandex guide',
      },
      {
        text:
          'Go to your Yandex ID → Security → enable two-factor authentication if not already on. ',
        href: 'https://yandex.com/support/id/en/authorization/app-passwords',
        linkLabel: 'app-password docs',
      },
      {
        text: 'Generate an ',
        href: 'https://id.yandex.com/security/app-passwords',
        linkLabel: 'app password',
        tail:
          ' (visible only once, becomes active in 2-3 hours) and paste it below.',
      },
    ],
  },
  {
    id: 'icloud',
    label: 'iCloud',
    brand: EMAIL_PROVIDER_BRANDS.icloud,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: '587',
    imapHost: 'imap.mail.me.com',
    imapPort: '993',
    hostsLabel: 'smtp.mail.me.com:587 (STARTTLS) · imap.mail.me.com:993 (SSL)',
    steps: [
      {
        text:
          'Make sure two-factor authentication is on for your Apple Account — without it App-Specific Passwords are not available.',
      },
      {
        text: 'Sign in to ',
        href: 'https://account.apple.com/',
        linkLabel: 'account.apple.com',
        tail:
          ' → Sign-In and Security → App-Specific Passwords → generate one and paste it as the password below.',
      },
      {
        text:
          'Use your full @icloud.com address as the SMTP username; for IMAP try the prefix only (e.g. johnappleseed) first, then full address if it fails. ',
        href: 'https://support.apple.com/HT202304',
        linkLabel: 'Apple server-settings reference',
      },
    ],
  },
  {
    id: 'outlook',
    label: 'Outlook.com',
    brand: EMAIL_PROVIDER_BRANDS.outlook,
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: '587',
    imapHost: 'outlook.office365.com',
    imapPort: '993',
    hostsLabel:
      'smtp-mail.outlook.com:587 (STARTTLS) · outlook.office365.com:993 (SSL)',
    steps: [
      {
        text:
          'In outlook.com open Settings → Mail → Sync email and toggle "Let devices and apps use POP and IMAP" → Save. ',
        href: 'https://support.microsoft.com/en-us/topic/8361e398-8af4-4e97-b147-6c6c4ac95353',
        linkLabel: 'Microsoft settings page',
      },
      {
        text: 'Enable two-step verification in your ',
        href: 'https://account.microsoft.com/security',
        linkLabel: 'Microsoft account security',
        tail: ' — required before App Passwords appear.',
      },
      {
        text: 'Create an ',
        href: 'https://account.live.com/proofs/AppPassword',
        linkLabel: 'App Password',
        tail:
          ' and paste it below. (Works for personal @outlook.com / @hotmail.com / @live.com / @msn.com only — work/school M365 accounts depend on tenant policy.)',
      },
    ],
  },
]

export function findEmailPreset(id: EmailProviderId | null): EmailProviderPreset | undefined {
  return EMAIL_PRESETS.find(p => p.id === id)
}
