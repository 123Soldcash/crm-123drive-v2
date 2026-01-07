/**
 * Gmail integration helper for sending emails via Manus MCP
 */

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  try {
    const { execSync } = await import('child_process');
    
    // Use manus-mcp-cli to send email via Gmail
    const command = `manus-mcp-cli tool call send_email --server gmail --input '${JSON.stringify({
      to: options.to,
      subject: options.subject,
      body: options.html || options.text,
    }).replace(/'/g, "\\'")}'`;

    const result = execSync(command, { encoding: 'utf-8' });
    return JSON.parse(result);
  } catch (error) {
    console.error('Gmail send error:', error);
    throw new Error('Failed to send email via Gmail');
  }
}

export async function sendInviteEmail(agentEmail: string, agentName: string, inviteLink: string) {
  const subject = 'You are invited to join the Property CRM';
  const text = `
Hi ${agentName},

You have been invited to join the Property CRM system as a birddog agent.

Click the link below to get started:
${inviteLink}

Once you sign in, you'll have access to:
- Property leads and opportunities
- Task management
- Communication tracking
- Agent performance metrics

Best regards,
CRM Admin
  `.trim();

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to Property CRM</h2>
  <p>Hi ${agentName},</p>
  <p>You have been invited to join the Property CRM system as a birddog agent.</p>
  <p>
    <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Get Started
    </a>
  </p>
  <p>Or copy this link: <code>${inviteLink}</code></p>
  <p>Once you sign in, you'll have access to:</p>
  <ul>
    <li>Property leads and opportunities</li>
    <li>Task management</li>
    <li>Communication tracking</li>
    <li>Agent performance metrics</li>
  </ul>
  <p>Best regards,<br>CRM Admin</p>
</div>
  `.trim();

  return sendEmail({
    to: agentEmail,
    subject,
    text,
    html,
  });
}
