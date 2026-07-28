const UserService = require('@services/user.service');
const RoleRepository = require('@repositories/role.repository');
const { sendSuccess } = require('@utils/response');
const mongoose = require('mongoose');
const {
  AFFILIATE_APPROVAL_STATUS,
  AFFILIATE_PENDING_STATUSES,
} = require('@constants/affiliateApproval');

class UserController {
  async getAll(req, res, next) {
    try {
      const { page, limit, role, tenant, search, isActive, affiliateApprovalStatus } = req.query;
      const filter = {};

      if (role) {
        if (mongoose.isValidObjectId(role)) {
          filter.role = role;
        } else {
          const roleDoc = await RoleRepository.findBySlug(String(role).toLowerCase());
          if (roleDoc) {
            filter.role = roleDoc._id;
          } else {
            filter.role = new mongoose.Types.ObjectId();
          }
        }
      }

      if (tenant) filter.tenant = tenant;

      if (isActive === 'true' || isActive === 'false') {
        filter.isActive = isActive === 'true';
      }

      if (affiliateApprovalStatus) {
        const statuses = String(affiliateApprovalStatus)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        if (statuses.includes('pending')) {
          filter.affiliateApprovalStatus = { $in: AFFILIATE_PENDING_STATUSES };
        } else if (statuses.includes('approved') && statuses.length === 1) {
          // Include legacy affiliates with no approval field
          filter.affiliateApprovalStatus = {
            $in: [AFFILIATE_APPROVAL_STATUS.APPROVED, null],
          };
        } else if (statuses.length === 1) {
          filter.affiliateApprovalStatus = statuses[0];
        } else if (statuses.length > 1) {
          filter.affiliateApprovalStatus = { $in: statuses };
        }
      }

      if (req.user.role.slug === 'admin' && req.user.tenant) {
        filter.tenant = req.user.tenant._id;
      }

      const result = await UserService.getAll(filter, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        search: search ? String(search).trim() : undefined,
      });

      return sendSuccess(res, {
        message: 'Users retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async affiliateStats(_req, res, next) {
    try {
      const stats = await UserService.getAffiliateStats();
      return sendSuccess(res, {
        message: 'Affiliate stats retrieved',
        data: { stats },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const user = await UserService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'User retrieved',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async createAffiliate(req, res, next) {
    try {
      const user = await UserService.createAffiliate(req.body);
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Affiliate created',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async scheduleAffiliateInterview(req, res, next) {
    try {
      const user = await UserService.scheduleAffiliateInterview(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'Interview scheduled. Google Meet link emailed to the affiliate.',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async holdAffiliate(req, res, next) {
    try {
      const user = await UserService.holdAffiliate(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'On hold — agreement PDF and upload link emailed',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async resumeAffiliate(req, res, next) {
    try {
      const user = await UserService.resumeAffiliate(req.params.id);
      return sendSuccess(res, {
        message: 'Affiliate application resumed from hold',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async requestSignedAgreementOnboarding(req, res, next) {
    try {
      const AffiliateOnboardingService = require('@services/affiliateOnboarding.service');
      const user = await AffiliateOnboardingService.requestUploadLink(req.params.id);
      return sendSuccess(res, {
        message: 'New signed-agreement upload link emailed',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async approveAffiliate(req, res, next) {
    try {
      const user = await UserService.approveAffiliate(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'Affiliate approved. Congratulations email with login credentials sent.',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async resendAffiliateCredentials(req, res, next) {
    try {
      const user = await UserService.resendAffiliateCredentials(req.params.id);
      return sendSuccess(res, {
        message: 'Login credentials email sent',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async rejectAffiliate(req, res, next) {
    try {
      const user = await UserService.rejectAffiliate(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'Affiliate application rejected',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAffiliateClients(req, res, next) {
    try {
      const portfolio = await UserService.getAffiliateClients(req.params.id, {
        search: req.query.search,
      });
      return sendSuccess(res, {
        message: 'Affiliate portfolio retrieved',
        data: portfolio,
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const user = await UserService.update(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'User updated',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await UserService.delete(req.params.id);
      return sendSuccess(res, {
        message: 'User deleted',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new UserController();
