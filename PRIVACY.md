# Privacy notice

This repository contains a prototype application that may process limited user data when deployed.

## Data that may be processed

- wallet public address
- profile fields submitted by the user
- interest selections and responses
- message content
- moderation events such as reports
- technical logs required to operate the service

## Why the data is processed

Data is used to:

- authenticate users with wallet signatures
- operate the matching and messaging flows
- detect abuse and moderate unsafe behavior
- maintain service reliability

## Data sharing

No sale of personal data is intended by this project.

Third-party infrastructure providers may process operational data as part of hosting, database, logging, or wallet-related services chosen by a deployer of this repository.

## Data retention

Retention depends on the deployment operated by the maintainer of a given instance. Anyone deploying this repository should define retention periods for profile, messaging, and moderation data.

## Security

This public repository does not include production secrets, private keystores, or local runtime databases. Deployers are responsible for protecting their own secrets and infrastructure.

Firebase Secret Manager should only contain server-side service credentials. It should not contain user emails, wallet addresses, user IDs, admin identifiers, session tokens, or other personal/private account data.

## Contact

Questions about privacy can be sent to:

`kuyaherber@proton.me`
