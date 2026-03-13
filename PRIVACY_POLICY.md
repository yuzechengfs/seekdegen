# Privacy Policy

Last updated: March 14, 2026

This Privacy Policy applies to `seekdegen`, including the Android app, the hosted web experience, and related backend services operated by a deployer of this project.

## 1. Information collected

Depending on how an instance of `seekdegen` is deployed, the service may collect and process:

- wallet public address used for sign-in
- profile information provided by the user
- interest selections, matching activity, and responses
- message content exchanged inside the product
- moderation events such as reports and safety actions
- technical logs required to operate, secure, and improve the service

`seekdegen` is not intended to collect private wallet keys or seed phrases.

## 2. How information is used

Information may be used to:

- authenticate users with wallet signatures
- operate profile, matching, story room, and messaging features
- enforce safety, moderation, and abuse-prevention rules
- maintain service reliability, debugging, and operational monitoring
- comply with legal obligations where required

## 3. How information may be shared

Information is not intended to be sold.

Information may be processed by infrastructure and service providers selected by the deployer of a given instance, such as:

- hosting providers
- database providers
- logging or monitoring providers
- wallet-related infrastructure providers
- AI or moderation providers if enabled by the deployer

## 4. Data retention

Retention periods depend on the specific deployment and the policies set by that deployer. Deployers should define retention periods for profile data, messages, moderation records, and technical logs.

## 5. Security

Deployers are responsible for protecting the infrastructure they operate.

This public repository does not include production secrets, private keystores, or local runtime databases. Firebase Secret Manager or any equivalent secret store should contain only server-side service credentials. It should not contain user emails, wallet addresses, user IDs, session tokens, or other personal account data.

## 6. User choices

Depending on the deployment, users may be able to:

- stop using the service at any time
- disconnect their wallet from the app
- request deletion or review of data held by the deployer of that specific instance

## 7. Children's privacy

`seekdegen` is not intended for children.

## 8. Changes to this policy

This Privacy Policy may be updated from time to time. The latest version should be published on its own dedicated page.

## 9. Contact

Privacy questions can be sent to:

`kuyaherber@proton.me`
