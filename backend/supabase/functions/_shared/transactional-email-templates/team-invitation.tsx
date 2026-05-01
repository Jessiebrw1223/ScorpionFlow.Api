import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ScorpionFlow'

interface TeamInvitationProps {
  inviterName?: string
  role?: string
  inviteUrl?: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin · Control total',
  collaborator: 'Colaborador · Acceso operativo',
  viewer: 'Visualizador · Solo lectura',
}

const TeamInvitationEmail = ({
  inviterName,
  role,
  inviteUrl,
}: TeamInvitationProps) => {
  const roleLabel = role ? ROLE_LABELS[role] || role : 'miembro del equipo'
  const safeUrl = inviteUrl || '#'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>
        {inviterName
          ? `${inviterName} te invitó a colaborar en ${SITE_NAME}`
          : `Te invitaron a colaborar en ${SITE_NAME}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandRow}>
            <Text style={brand}>🦂 {SITE_NAME}</Text>
          </Section>

          <Heading style={h1}>
            {inviterName
              ? `${inviterName} te invitó a colaborar`
              : 'Te invitaron a colaborar'}
          </Heading>

          <Text style={text}>
            Has sido invitado a unirte al equipo en <strong>{SITE_NAME}</strong>{' '}
            como <strong>{roleLabel}</strong>.
          </Text>

          <Text style={text}>
            ScorpionFlow es la plataforma donde el equipo trabaja con la misma
            información financiera y operativa. La claridad no sirve si no es
            compartida.
          </Text>

          <Section style={ctaSection}>
            <Button href={safeUrl} style={button}>
              Aceptar invitación
            </Button>
          </Section>

          <Text style={smallText}>
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </Text>
          <Text style={linkText}>{safeUrl}</Text>

          <Text style={footer}>
            Esta invitación expira en 14 días. Si no esperabas este correo,
            puedes ignorarlo.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TeamInvitationEmail,
  subject: (data: Record<string, any>) =>
    data.inviterName
      ? `${data.inviterName} te invitó a colaborar en ${SITE_NAME}`
      : `Te invitaron a colaborar en ${SITE_NAME}`,
  displayName: 'Invitación de equipo',
  previewData: {
    inviterName: 'María Pérez',
    role: 'collaborator',
    inviteUrl: 'https://scorpion-flow.com/invite/sample-token',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = {
  padding: '32px 24px',
  maxWidth: '560px',
  margin: '0 auto',
}
const brandRow = { marginBottom: '24px' }
const brand = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#ea580c',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  margin: 0,
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 20px',
  lineHeight: '1.3',
}
const text = {
  fontSize: '15px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const ctaSection = { margin: '28px 0', textAlign: 'center' as const }
const button = {
  backgroundColor: '#ea580c',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
}
const smallText = {
  fontSize: '13px',
  color: '#64748b',
  margin: '24px 0 6px',
}
const linkText = {
  fontSize: '12px',
  color: '#ea580c',
  wordBreak: 'break-all' as const,
  margin: '0 0 24px',
}
const footer = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '32px 0 0',
  borderTop: '1px solid #e2e8f0',
  paddingTop: '16px',
}
