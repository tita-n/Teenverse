import React from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="privacy-policy-container">
      <h1 className="policy-title">Privacy Policy for TeenVerse</h1>
      <p className="effective-date">Effective Date: 6th May 2025</p>

      <section className="policy-section">
        <h2 className="section-title">1. Information We Collect</h2>
        <p>
          We may collect the following types of information when you use TeenVerse:
        </p>
        <ul>
          <li><strong>Personal Information:</strong> Information that identifies you, such as your name, email address, and date of birth.</li>
          <li><strong>Usage Data:</strong> Details of how you interact with the app, including device information, operating system, IP address, and app usage patterns.</li>
          <li><strong>Location Data:</strong> We may collect your location information to provide location-based services (e.g., nearby meetups).</li>
          <li><strong>User-Generated Content:</strong> Any content you post, share, or interact with within the app, including text, images, and videos.</li>
        </ul>
      </section>

      <section className="policy-section">
        <h2 className="section-title">2. How We Use Your Information</h2>
        <p>We use the collected information for the following purposes:</p>
        <ul>
          <li>To provide, personalize, and improve TeenVerse’s features and services.</li>
          <li>To monitor and analyze app usage and performance.</li>
          <li>To communicate with you regarding updates, offers, or service-related notifications.</li>
          <li>To ensure the safety and security of our platform, including moderating user-generated content and enforcing community guidelines.</li>
        </ul>
      </section>

      <section className="policy-section">
        <h2 className="section-title">3. How We Protect Your Information</h2>
        <p>
          We implement security measures to protect your data, including encryption, secure data storage, and access control. However, no data transmission over the internet can be guaranteed to be 100% secure, and we cannot ensure the absolute security of your information.
        </p>
      </section>

      <section className="policy-section">
        <h2 className="section-title">4. Sharing Your Information</h2>
        <p>
          We do not sell or rent your personal information. However, we may share your information with third-party service providers who assist us in operating the app and improving our services. These providers are bound by confidentiality agreements.
        </p>
        <p>
          We may also disclose your information if required by law, or to protect our rights, users, or the safety of the public.
        </p>
      </section>

      <section className="policy-section">
        <h2 className="section-title">5. Your Rights and Choices</h2>
        <ul>
          <li><strong>Access and Update:</strong> You can access and update your personal information through the app’s settings.</li>
          <li><strong>Deletion:</strong> You can delete your account and data by contacting us at restorationmichael3@gmail.comor through the app.</li>
          <li><strong>Opt-Out:</strong> You can opt-out of certain data collection practices by disabling location services or opting out of promotional emails.</li>
        </ul>
      </section>

      <section className="policy-section">
        <h2 className="section-title">6. Children’s Privacy</h2>
        <p>
          TeenVerse is intended for users aged 13-19. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete it.
        </p>
      </section>

      <section className="policy-section">
        <h2 className="section-title">7. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Any changes will be posted on this page, and the "Effective Date" at the top will be updated. We encourage you to review this Privacy Policy periodically to stay informed about how we are protecting your information.
        </p>
      </section>

      <section className="policy-section">
        <h2 className="section-title">8. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
        <p>Email: restorationmichael,3@gmail.com</p>
        <p>Address: Lagos, Nigeria</p>
      </section>
    </div>
  );
}

export default PrivacyPolicy;
                     
