import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-display mb-2">Privacy Policy</h1>
        <p className="text-tx-muted mb-8">Effective Date: 6th May 2025</p>

        <div className="space-y-8">
          <Section title="1. Information We Collect">
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Personal Information:</strong> Name, email address, date of birth</li>
              <li><strong>Usage Data:</strong> Device info, IP address, app usage patterns</li>
              <li><strong>Location Data:</strong> For location-based services (optional)</li>
              <li><strong>User Content:</strong> Posts, images, and videos you share</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc ml-6 space-y-1">
              <li>Provide, personalize, and improve TeenVerse features</li>
              <li>Monitor and analyze app performance</li>
              <li>Send service-related notifications</li>
              <li>Ensure platform safety and enforce community guidelines</li>
            </ul>
          </Section>

          <Section title="3. How We Protect Your Information">
            <p>We implement encryption, secure storage, and access controls. However, no internet transmission is 100% secure.</p>
          </Section>

          <Section title="4. Sharing Your Information">
            <p>We do not sell your data. We may share with trusted service providers under confidentiality agreements, or disclose as required by law.</p>
          </Section>

          <Section title="5. Your Rights">
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Access & Update:</strong> Via app settings</li>
              <li><strong>Deletion:</strong> Contact us at restorationmichael3@gmail.com</li>
              <li><strong>Opt-Out:</strong> Disable location or promotional emails</li>
            </ul>
          </Section>

          <Section title="6. Children's Privacy">
            <p>TeenVerse is for ages 13-19. We do not knowingly collect data from children under 13.</p>
          </Section>

          <Section title="7. Contact Us">
            <p>Email: <a href="mailto:restorationmichael3@gmail.com" className="text-brand-600 hover:underline">restorationmichael3@gmail.com</a></p>
            <p>Address: Lagos, Nigeria</p>
          </Section>
        </div>
      </div>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-h3 mb-3">{title}</h2>
      <div className="text-tx-secondary leading-relaxed">{children}</div>
    </section>
  );
}

export default PrivacyPolicy;
