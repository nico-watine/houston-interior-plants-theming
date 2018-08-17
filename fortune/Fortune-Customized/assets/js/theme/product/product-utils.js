import _ from 'lodash';
import utils from '@bigcommerce/stencil-utils';
import Alert from '../global/Alert';
import productViewTemplates from './productViewTemplates';
import progressButton from './progressButton';
import initFormSwatch from '../core/formSelectedValue';
import OverlayUtils from '../global/overlay-utils';

export default class ProductUtils {
  constructor(el, context, imageSwitch = {}) {
    this.context = context;
    this.$body = $(document.body);
    this.$productBlock = $(el);
    this.productTitle  = this.$productBlock.data('product-title');
    this.productId     = this.$productBlock.data('product-id');
    this.canPurchase   = this.$productBlock.data('product-purchasable');

    if (!this.productTitle) {
      this.productTitle = this.$productBlock.find('[data-product-title]').data('product-title');
    }
    if (!this.productId) {
      this.productId = this.$productBlock.find('[data-product-id]').data('product-id');
    }

    // two alert locations based on action
    this.cartAddAlert = new Alert(this.$productBlock.find('[data-product-cart-message]'));
    this.cartOptionAlert = new Alert(this.$productBlock.find('[data-product-option-message]'));

    // callback after product variation link has been appended
    this.imageSwitch = imageSwitch;
  }

  init() {
    this._bindProductOptions();
    this._bindCartSubmit();

    initFormSwatch();

    if (this.$productBlock.hasClass('product-container')) {
      this._updateAttributes(window.BCData.product_attributes);
    } else {
      // Trigger a change event so the values are correct for pre-selected options
      this.$productBlock.find('[data-product-attribute-value]').eq(0).find('input').trigger('change');
    }
  }

  // -------------------------- Adding to Cart -------------------------- //

  /**
   * Run DOM manipulations on cart add
   */
  _bindCartSubmit() {
    utils.hooks.on('cart-item-add', (event, form) => {

      /*
       Do not do AJAX if:
        - Browser doesn't support FormData. No IE9.
        - Merchant has disabled ajax submission
      */
      if (window.FormData === undefined) {
        return;
      }

      event.preventDefault();

      const $button = this.$productBlock.find('.add-to-cart');
      const formData = new FormData(form);

      progressButton.progress($button);

      utils.api.cart.itemAdd(this.filterEmptyFilesFromForm(formData), (err, response) => {
        let isError = false;
        let message = response;

        if (err || response.data.error) {
          isError = true;
          message = err || response.data.error;
        }

        if (!isError && this.context.disableProductAjax) {
          window.location = this.context.cartUrl;
        }

        setTimeout(() => {
          this._updateMessage(isError, message);
          progressButton.complete($button);
        }, 500);
      });
    });
  }

  /**
   * Enable add to cart of product just given id
   * Needs to be a product with no options. Only one is added.
   * @param {jQuery} $buttons - a set of matched elements to be clicked,
     each with data-product-id and data-product-title attributes
   */
  static bindRemoteAdd(context, $buttons) {
    $buttons.on('click', (event) => {
      // Create an overlay when remotely adding to the cart
      new OverlayUtils().show();

      const quantity = 1;
      const $thisButton = $(event.currentTarget);
      const productId = $thisButton.data('product-id');
      const productTitle = $thisButton.data('product-title');

      // Do not do AJAX if browser doesn't support FormData. No IE9.
      if (window.FormData === undefined || !productId) { return; }

      event.preventDefault();

      progressButton.progress($thisButton);

      const formData = new FormData();
      formData.append('action', 'add');
      formData.append('product_id', productId);
      formData.append('qty', quantity);

      utils.api.cart.itemAdd(formData, (err, response) => {
        let message;

        if (err || response.data.error) {
          message = err || response.data.error;
        } else {
          message = context.messagesProductAddSuccessAlert.replace('*product*', productTitle);
        }

        if (context.disableProductAjax && !(err || response.data.error)) {
          return window.location = context.cartUrl;
        }

        $(document.body).trigger('quick-cart-refresh');

        setTimeout(() => {
          alert(message);
          progressButton.complete($thisButton);
        }, 500);
      });
    });
  }

  /**
   * On successful ajax cart add we want to clear all option inputs.
   *
   */
  _clearInputs() {
    const $inputs = this.$productBlock.find('[name^="attribute"]');

    $inputs.each((index, input) => {
      const $input = $(input);

      switch (input.type) {
        case 'checkbox':
          $input.prop('checked', false);
          break;
        case 'radio':
          $input.prop('checked', false);
          if ($input.hasClass('input-swatch')) {
            $input.parent('.form-label').removeClass('active');
          }
          break;
        case 'select':
          $input.val($input.find('[value]:first').val()); // reset selects to first selectable value
          break;
        default:
          $input.val('');
      }
    });
  }

  /**
   * Show feedback on cart button click.
   * @param {boolean} isError - was the cart submit an error or success?
   * @param {string} response - request response text from bigcommerce
   */
  _updateMessage(isError, response) {
    let message = '';

    if (isError) {
      message = response;
    } else {

      message = this.context.messagesProductAddSuccess;
      message = message
                  .replace('*product*', this.productTitle)
                  .replace('*cart_link*', `<a href='${this.context.urlsCart}'>${this.context.messagesCartLink}</a>`)
                  .replace('*continue_link*', `<a href='${this.context.homeLink}'>${this.context.continueShopping}</a>`)
                  .replace('*checkout_link*', `<a href='${this.context.urlsCheckout}'>${this.context.messagesCheckoutLink}</a>`);
    }

    this.cartAddAlert.message(message, (isError ? 'error' : 'success'), true);
  }

  // -------------------------- Product Options -------------------------- //

  /**
   * Build object of jQuery objects for easier(?) dom updating
   * @param {jQuery} $scope - the current product block.
   */
  _getViewModel($el) {
    return {
      $price: $('[data-price="without-tax"]', $el),
      $priceWithTax: $('[data-price="with-tax"]', $el),
      $saved: $('[data-price-saved]', $el),
      $sku: $('[data-product-sku]', $el),
      $weight: $('[data-product-weight]', $el),
      $addToCart: $('[data-button-purchase]', $el),
      $imagePreview: $('[data-variation-preview]', $el),
      $buttonText: $('.button-text', $el),
      stock: {
        $selector: $('[data-product-stock]', $el),
        $level: $('[data-product-stock-level]', $el),
      },
    };
  }

  /**
  * https://stackoverflow.com/questions/49672992/ajax-request-fails-when-sending-formdata-including-empty-file-input-in-safari
  * Safari browser with jquery 3.3.1 has an issue uploading empty file parameters. This function removes any empty files from the form params
  * @param formData: FormData object
  * @returns FormData object
  */
  filterEmptyFilesFromForm(formData) {
    try {
      for (const [key, val] of formData) {
        if (val instanceof File && !val.name && !val.size) {
          formData.delete(key);
        }
      }
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
    }
    return formData;
  }

  /**
   * Run DOM manipulation on product options change.
   */
  _bindProductOptions() {
    utils.hooks.on('product-option-change', (event, changedOption) => {
      const $changedOption = $(changedOption);
      const $form = this.$productBlock.find('[data-cart-item-add]');

      // Do not trigger an ajax request if it's a file or if the browser doesn't support FormData
      if ($changedOption.attr('type') === 'file' || window.FormData === undefined || $changedOption.attr('name') === 'qty[]') {
        return;
      }

      this.cartOptionAlert.clear();

      utils.api.productAttributes.optionChange(this.productId, $form.serialize(), (err, response) => {
        this.cartAddAlert.clear();

        const viewModel = this._getViewModel(this.$productBlock);
        const data = response ? response.data : {};

        this._updateAttributes(data);

        if (viewModel.$sku.length) {
          viewModel.$sku.html(data.sku);
        }

        if (viewModel.$weight.length && data.weight) {
          viewModel.$weight.html(data.weight.formatted);
        }

        // if stock view is on (CP settings)
        if (viewModel.stock.$selector.length && data.stock) {

          viewModel.stock.$level.text(data.stock);
          // if the stock container is hidden, show
          if (viewModel.stock.$selector.hasClass('single-product-detail-hidden')) {
            viewModel.stock.$selector.removeClass('single-product-detail-hidden');
          }
        }

        if (viewModel.$price.length && _.isObject(data.price)) {
          const priceStrings = {
            price: data.price,
            excludingTax: this.context.productExcludingTax,
          };
          viewModel.$price.html(productViewTemplates.priceWithoutTax(priceStrings));
        }

        if (viewModel.$priceWithTax.length && _.isObject(data.price)) {
          const priceStrings = {
            price: data.price,
            includingTax: this.context.productIncludingTax,
          };
          viewModel.$priceWithTax.html(productViewTemplates.priceWithTax(priceStrings));
        }

        if (viewModel.$saved.length && _.isObject(data.price)) {
          const priceStrings = {
            price: data.price,
            savedString: this.context.productYouSave,
          };
          viewModel.$saved.html(productViewTemplates.priceSaved(priceStrings));
        }

        if (data.image) {
          const templateData = {
            src: utils.tools.image.getSrc(
              data.image.data,
              this.context.themeImageSizes.product
            ),
            previewLabel: this.context.productPreviewVariation,
          };

          if(this.imageSwitch){
            viewModel.$imagePreview.html(productViewTemplates.variationPreviewImage(templateData));
            this.imageSwitch();
          }
        } else {
          viewModel.$imagePreview.empty();
        }

        this.cartOptionAlert.clear();

        let buttonText = this.context.productAddToCart;
        let buttonDisabled = false;

        if (!data.purchasable || !data.instock) {
          this.cartOptionAlert.error((data.purchasing_message || this.context.productOptionUnavailable), true);
          buttonDisabled = true;
          buttonText = this.context.productSoldOut;
        } else {
          if (viewModel.$addToCart.is('[data-button-preorder]')) {
            buttonText = this.context.productPreOrder;
          }

          buttonDisabled = false;
        }

        viewModel.$addToCart.prop('disabled', buttonDisabled);
        viewModel.$buttonText.text(buttonText);
      });
    });
  }

    // -- Product Stock Callbacks -- //
  _updateAttributes(data) {
    if (data === undefined) { return; }

    const behavior = data.out_of_stock_behavior;
    const inStockIds = data.in_stock_attributes;
    const outOfStockMessage = ` (${data.out_of_stock_message})`;

    if (behavior !== 'hide_option' && behavior !== 'label_option') {
      return;
    }

    $('[data-product-attribute-value]', this.$productBlock).each((i, attribute) => {
      const $attribute = $(attribute);
      const attrId = parseInt($attribute.data('product-attribute-value'), 10);

      if (inStockIds.indexOf(attrId) !== -1) {
        this._enableAttribute($attribute, behavior, outOfStockMessage);
      } else {
        this._disableAttribute($attribute, behavior, outOfStockMessage);
      }
    });
  }

  _disableAttribute($attribute, behavior, outOfStockMessage) {
    if (this._getAttributeType($attribute) === 'set-select') {
      return this.disableSelectOptionAttribute($attribute, behavior, outOfStockMessage);
    }

    if (behavior === 'hide_option') {
      $attribute.hide();
    } else {
      $attribute.addClass('option-unavailable');
    }
  }

  disableSelectOptionAttribute($attribute, behavior, outOfStockMessage) {
    if (behavior === 'hide_option') {
      $attribute.toggleOption(false);
    } else {
      $attribute.attr('disabled', 'disabled');
      $attribute.html($attribute.html().replace(outOfStockMessage, '') + outOfStockMessage);
    }
  }

  _enableAttribute($attribute, behavior, outOfStockMessage) {
    if (this._getAttributeType($attribute) === 'set-select') {
      return this.enableSelectOptionAttribute($attribute, behavior, outOfStockMessage);
    }
    if (behavior === 'hide_option') {
      $attribute.show();
    } else {
      $attribute.removeClass('option-unavailable');
    }
  }

  enableSelectOptionAttribute($attribute, behavior, outOfStockMessage) {
    if (behavior === 'hide_option') {
      $attribute.toggleOption(true);
    } else {
      $attribute.removeAttr('disabled');
      $attribute.html($attribute.html().replace(outOfStockMessage, ''));
    }
  }

  _getAttributeType($attribute) {
    const $parent = $attribute.closest('[data-product-attribute]');
    return $parent ? $parent.data('product-attribute') : null;
  }
}
