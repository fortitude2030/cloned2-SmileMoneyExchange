# Organization Onboarding Rules & Flow
## Zambian E-Money Platform - Regulatory Compliance Framework

### Overview
Complete organization onboarding system for licensed e-money issuers operating in Zambia, ensuring full compliance with Bank of Zambia regulations and AML requirements.

## Onboarding Stages

### Stage 1: Organization Registration
**Required Information:**
- Legal business name
- PACRA registration number
- ZRA TPIN certificate number
- Business type classification
- Physical address
- Contact information (email, phone)
- Primary business director details

**Validation:**
- PACRA number format verification
- ZRA TPIN authenticity check
- Business address validation
- Director identity verification

### Stage 2: KYC Documentation Upload
**Required Documents:**
1. **PACRA Certificate** - Business registration proof
2. **ZRA TPIN Certificate** - Tax compliance verification
3. **Director NRC (Front & Back)** - Identity verification
4. **Director Selfie** - Live identity confirmation
5. **Bank Account Details** - Settlement account verification

**Document Requirements:**
- Maximum file size: 5MB per document
- Accepted formats: PDF, JPG, PNG
- Clear, legible images required
- Documents must be current (issued within 6 months)

### Stage 3: Risk Assessment & Limits Configuration
**Transaction Limits (ZMW):**
- **Single Transaction Limit:** 500,000 (default)
- **Daily Transaction Limit:** 5,000,000 (default)
- **Monthly Transaction Limit:** 50,000,000 (default)

**AML Risk Rating:**
- **Low Risk:** Established businesses, verified history
- **Medium Risk:** Standard rating for new businesses
- **High Risk:** High-volume traders, cross-border activities

**Risk Factors Considered:**
- Business type and sector
- Expected transaction volumes
- Geographic operations
- Director background checks
- Previous regulatory history

### Stage 4: Final Approval
**Approval Criteria:**
- All KYC documents verified
- Risk assessment completed
- Transaction limits configured
- AML monitoring enabled
- Bank of Zambia compliance confirmed

**Approval Authority:**
- Admin approval required for all organizations
- Super admin override for high-risk cases
- Automatic notifications to relevant parties

## Organization Status Classifications

### Primary Status
- **Pending:** Initial registration submitted
- **Approved:** Fully onboarded and operational
- **Suspended:** Temporarily disabled due to compliance issues
- **Rejected:** Failed onboarding requirements

### KYC Status
- **Pending:** Documents not yet submitted
- **Incomplete:** Missing required documents
- **In Review:** Documents under admin review
- **Verified:** All documents approved
- **Rejected:** Documents failed verification

## Compliance Requirements

### Bank of Zambia Reporting
- Monthly transaction volume reports
- Quarterly AML alert summaries
- Annual compliance assessments
- Incident reporting within 24 hours

### AML Monitoring
**Automated Checks:**
- Velocity monitoring (transaction frequency)
- Threshold monitoring (amount limits)
- Pattern analysis (unusual behavior)
- Geographic risk assessment

**Alert Triggers:**
- Single transaction >500,000 ZMW
- Daily volume >5,000,000 ZMW
- Unusual transaction patterns
- High-risk geographic locations

### Data Retention
- Transaction records: 7 years minimum
- KYC documents: 5 years after account closure
- AML alerts: 7 years from resolution
- Audit logs: 10 years for compliance

## Operational Limits

### Default Transaction Limits
```
Business Type          | Single Tx  | Daily Limit | Monthly Limit
--------------------- | ---------- | ----------- | -------------
Retail                | 500,000    | 5,000,000   | 50,000,000
Wholesale             | 1,000,000  | 10,000,000  | 100,000,000
Manufacturing         | 2,000,000  | 20,000,000  | 200,000,000
Financial Services    | 5,000,000  | 50,000,000  | 500,000,000
```

### Limit Adjustment Criteria
- Business history and volume
- Compliance track record
- Risk assessment results
- Regulatory approval status

## Admin Controls

### Organization Management Actions
1. **Approve/Suspend/Reject** - Change organization status
2. **Limit Management** - Adjust transaction limits
3. **Document Review** - Verify KYC submissions
4. **Risk Rating Updates** - Modify AML classifications
5. **Bulk Operations** - Mass status changes

### Audit Trail Requirements
- All actions logged with timestamps
- User identification for all changes
- Reason codes for status changes
- Document access tracking

## Integration Points

### External Systems
- **Bank of Zambia API** - Regulatory reporting
- **PACRA Verification** - Business registration checks
- **ZRA Integration** - Tax compliance validation
- **Banking Partners** - Settlement account verification

### Internal Workflows
- User notification system
- AML alert generation
- Settlement request processing
- Compliance report automation

## Error Handling

### Common Issues & Resolutions
1. **Invalid PACRA Number** - Request corrected documentation
2. **Expired Documents** - Require current certificates
3. **Failed Identity Verification** - Request additional documentation
4. **Risk Assessment Delays** - Escalate to senior admin

### Escalation Matrix
- **Level 1:** System Admin - Standard approvals
- **Level 2:** Senior Admin - High-risk cases
- **Level 3:** Compliance Officer - Regulatory issues
- **Level 4:** Management - Policy exceptions

## Performance Metrics

### Onboarding KPIs
- Average onboarding time: <5 business days
- Document approval rate: >95%
- First-time approval rate: >80%
- Customer satisfaction: >4.5/5

### Compliance Metrics
- AML alert response time: <2 hours
- Regulatory report accuracy: 100%
- Document retention compliance: 100%
- Audit finding resolution: <30 days

## Security Measures

### Document Security
- Encrypted storage for all documents
- Access control with role-based permissions
- Regular security audits
- Secure document transmission

### Data Protection
- PII encryption at rest and in transit
- Regular backup procedures
- Disaster recovery protocols
- GDPR compliance measures

## Training Requirements

### Admin Staff Training
- KYC document verification procedures
- AML risk assessment techniques
- Regulatory compliance requirements
- System operation protocols

### Ongoing Education
- Quarterly compliance updates
- Annual regulatory training
- Technology platform updates
- Security awareness programs

---

**Document Version:** 1.0  
**Last Updated:** June 2025  
**Next Review:** December 2025  
**Approval:** Compliance Team & Management