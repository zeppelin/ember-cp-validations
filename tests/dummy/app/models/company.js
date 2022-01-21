import DS from 'ember-data';
import { validator, buildValidations } from '@qonto/ember-cp-validations';

export const Validations = buildValidations({
  name: validator('presence', { presence: true, description: 'Name' })
});

export default DS.Model.extend(Validations, {
  name: DS.attr('string')
});
