use Mix.Config

# Configure your database
config :jwp, Jwp.Repo,
  username: "jwp_test",
  password: "jwp_test",
  database: "jwp_test",
  hostname: "localhost",
  port: 8827,
  pool: Ecto.Adapters.SQL.Sandbox

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :jwp, JwpWeb.Endpoint,
  http: [port: 4002],
  server: false

# Print only warnings and errors during test
config :logger, level: :warn
