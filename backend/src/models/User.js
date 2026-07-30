const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    middleName: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    birthDate: {
      type: Date,
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 8,
      select: false,
    },
    /** Plaintext last issued by SA on approve/resend — for View only (select:false) */
    affiliateIssuedPassword: {
      type: String,
      default: null,
      select: false,
    },
    affiliateCredentialsIssuedAt: {
      type: Date,
      default: null,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    googleId: {
      type: String,
      // Intentionally no default — null values break unique sparse indexes
    },
    avatar: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    /** Affiliate only: student | social_media_creator | freelancer_digital_marketer */
    affiliateType: {
      type: String,
      enum: {
        values: ['student', 'social_media_creator', 'freelancer_digital_marketer', null],
        message: 'Invalid affiliate type',
      },
      default: null,
    },
    /** student_id for students; aadhaar for other affiliate types */
    verificationDocumentKind: {
      type: String,
      enum: {
        values: ['student_id', 'aadhaar', null],
        message: 'Invalid verification document kind',
      },
      default: null,
    },
    verificationDocumentName: {
      type: String,
      trim: true,
      default: '',
    },
    /** Base64 data URL — excluded from default queries */
    verificationDocument: {
      type: String,
      default: null,
      select: false,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    /** Student */
    collegeName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    universityName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    /** Social media creator / influencer */
    socialMediaAccount: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    /** Freelancer / digital marketer resume */
    resumeDocumentName: {
      type: String,
      trim: true,
      default: '',
    },
    resumeDocument: {
      type: String,
      default: null,
      select: false,
    },
    /** Why the affiliate wants to join */
    joinReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    /**
     * Affiliate onboarding:
     * pending_review → on_hold | interview_scheduled → approved | rejected
     * Login allowed only when approved (legacy affiliates with null are treated as approved).
     */
    affiliateApprovalStatus: {
      type: String,
      enum: {
        values: [
          'pending_review',
          'on_hold',
          'interview_scheduled',
          'approved',
          'rejected',
          null,
        ],
        message: 'Invalid affiliate approval status',
      },
      default: null,
    },
    affiliateHoldNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    affiliateHeldAt: {
      type: Date,
      default: null,
    },
    /** Signed affiliate agreement upload (onboarding link) */
    signedAgreementDocumentName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    signedAgreementDocument: {
      type: String,
      default: null,
      select: false,
    },
    signedAgreementUploadedAt: {
      type: Date,
      default: null,
    },
    signedAgreementUploadTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    signedAgreementUploadExpiresAt: {
      type: Date,
      default: null,
    },
    signedAgreementOnboardingSentAt: {
      type: Date,
      default: null,
    },
    interviewMeetLink: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    /** When the interview meeting will take place */
    interviewAt: {
      type: Date,
      default: null,
    },
    /** When the schedule action was recorded */
    interviewScheduledAt: {
      type: Date,
      default: null,
    },
    interviewNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    affiliateDecisionAt: {
      type: Date,
      default: null,
    },
    affiliateDecisionNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    /** Join order for partner promo codes (1, 2, 3…) */
    affiliatePartnerNumber: {
      type: Number,
      default: null,
      min: 1,
    },
    /** Auto Partner discount code, e.g. 1SRUJAN@20% */
    affiliateDiscountCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      maxlength: 40,
    },
    affiliateDiscountPercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    /** Per-affiliate earning % override (null = use Affiliate Settings for type) */
    affiliateEarningPercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    /** Per-affiliate redeem target override in INR (null = use Affiliate Settings for type) */
    affiliateMinimumTargetValue: {
      type: Number,
      default: null,
      min: 0,
    },
    /** Optional saved payout details for future redeems */
    affiliatePayoutAccountHolderName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    affiliatePayoutAccountNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: 32,
    },
    affiliatePayoutIfsc: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: 20,
    },
    affiliatePayoutBankName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    affiliatePayoutUpiId: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 120,
    },
    /** One-time link to view issued login details (email avoids putting password in body) */
    affiliateCredentialsClaimTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    affiliateCredentialsClaimExpiresAt: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ').trim();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ role: 1 });
userSchema.index({ tenant: 1 });
// Affiliate list + stat count queries filter on these three together
userSchema.index({ role: 1, affiliateApprovalStatus: 1, isActive: 1 });
// Only enforce uniqueness when googleId is a real string (not null/missing)
userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $type: 'string' } },
  }
);

module.exports = mongoose.model('User', userSchema);
