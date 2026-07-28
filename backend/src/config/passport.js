const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('@config');
const AuthService = require('@services/auth.service');
const UserRepository = require('@repositories/user.repository');

const configurePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const roleSlug = req.query.state || 'admin';
          const user = await AuthService.findOrCreateGoogleUser({ profile, roleSlug });
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await UserRepository.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

module.exports = { configurePassport, passport };
