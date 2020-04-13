defmodule JwpWeb.Router do
  use JwpWeb, :router
  use Pow.Phoenix.Router

  pipeline :api do
    plug :accepts, ["json"]
    plug JwpWeb.Plug.ApiAuth, otp_app: :jwp
  end

  pipeline :api_protected do
    plug Pow.Plug.RequireAuthenticated, error_handler: JwpWeb.ApiErrorHandler
  end

  # scope "/" do
  #   pow_routes()
  # end

  scope "/api/v1", JwpWeb do
    pipe_through [:api, :api_protected]
    post "/token/authorize-socket", TokenController, :auth_socket
    post "/push", PushController, :push_message
  end
end
