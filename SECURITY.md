# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

The integration stores under `/data` only the address of the Tdarr server read
last, the names of the nodes it has seen and the date of the newest file error
announced. The API key of Tdarr stays in the configuration of Gladys: it is
sent to the Tdarr server only, in the `x-api-key` header, and never written to
the logs. The answers of Tdarr hold the API keys of the nodes and the Tdarr Pro
key: the integration keeps neither. It only talks to the address configured,
over the local network; no cloud service, no inbound port.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Tdarr itself.
