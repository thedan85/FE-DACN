# Aquarium Store

Headless aquarium e-commerce: a customer-facing storefront and a company-facing admin portal, both served by the same Spring Boot API.

## Language

**Admin portal**:
The company-facing side of the system, entered through the admin login portal. Serves every role except Customer.
_Avoid_: staff portal, back office, CMS

**Company account**:
An account whose role is not Customer — entitled to the admin portal.
_Avoid_: admin (as a blanket term), internal user, staff account

**Customer**:
An account that shops the storefront. The only role allowed to sign in with Google.
_Avoid_: user, buyer, shopper

**Guest**:
An unauthenticated visitor.
_Avoid_: anonymous user
