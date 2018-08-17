import _ from 'lodash';

export default {
  priceWithoutTax: _.template(`
    <% if(price) { %>
      <% if (price.rrp_without_tax) { %>
        <span class="price-rrp" data-price-rrp="without-tax"><%= price.rrp_without_tax.formatted %></span>
      <% } %>

      <% if (price.without_tax) { %>
        <span class="price-value" data-price-value="without-tax"><%= price.without_tax.formatted %></span>

        <% if (price.with_tax) { %>
          <span class="price-tax-label"><%= excludingTax %></span>
        <% } %>
      <% } %>
    <% } %>
  `),

  priceWithTax: _.template(`
    <% if(price) { %>
      <% if (price.rrp_with_tax) { %>
        <span class="price-rrp" data-price-rrp="with-tax"><%= price.rrp_with_tax.formatted %></span>
      <% } %>

      <% if (price.with_tax) { %>
        <span class="price-value" data-price-value="with-tax"><%= price.with_tax.formatted %></span>

        <% if (price.without_tax) { %>
          <span class="price-tax-label"><%= includingTax %></span>
        <% } %>
      <% } %>
    <% } %>
  `),

  priceSaved: _.template(`
    <% if(price) { %>
      <% if (price.saved) { %>
        <%= savedString %>
      <% } %>
    <% } %>
  `),

  variationPreviewImage: _.template(`
    <a class="variation-preview" href="<%= src %>">
      <div class="variation-preview-thumb-wrap">
        <div class="variation-preview-thumb" style="background-image:url(<%= src %>)"></div>
      </div>
      <span class="variation-preview-label"><%= previewLabel %></span>
    </a>
  `),
};
